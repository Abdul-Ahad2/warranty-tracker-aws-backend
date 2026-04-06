import { SchedulerClient, CreateScheduleCommand, DeleteScheduleCommand } from "@aws-sdk/client-scheduler";

const scheduler = new SchedulerClient({ region: "us-east-1" });

/**
 * Schedules two one-time notifications for a warranty: 7 days before and on expiry day.
 * @param {Object} warranty - The warranty object
 */
export const scheduleExpiryNotifications = async (warranty) => {
  const expiryDate = new Date(warranty.expiryDate);
  
  // 1. Calculate the 7-day-before date
  const sevenDaysBefore = new Date(expiryDate);
  sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
  
  // 2. Create the schedules
  const schedules = [
    {
      name: `expiry-7day-${warranty.id}`,
      time: sevenDaysBefore,
      type: "warning"
    },
    {
      name: `expiry-now-${warranty.id}`,
      time: expiryDate,
      type: "final"
    }
  ];

  for (const schedule of schedules) {
    // Only schedule if the date is in the future
    if (schedule.time > new Date()) {
      const params = {
        Name: schedule.name,
        ScheduleExpression: `at(${schedule.time.toISOString().split('.')[0]})`, // Correct format: at(yyyy-mm-ddThh:mm:ss)
        FlexibleTimeWindow: { Mode: "OFF" },
        Target: {
          Arn: `arn:aws:lambda:us-east-1:${process.env.AWS_ACCOUNT_ID}:function:warrantor-backend-${process.env.SLS_STAGE}-dispatch`,
          RoleArn: process.env.SCHEDULER_ROLE_ARN,
          Input: JSON.stringify({
            userId: warranty.userId,
            warrantyId: warranty.id,
            productName: warranty.productName,
            expiryDate: warranty.expiryDate,
            type: schedule.type
          }),
        },
        ActionAfterCompletion: "DELETE",
      };

      try {
        const command = new CreateScheduleCommand(params);
        await scheduler.send(command);
        console.log(`Successfully scheduled ${schedule.name} for ${schedule.time.toISOString()}`);
      } catch (error) {
        console.error(`Error scheduling ${schedule.name}:`, error);
      }
    }
  }
};

/**
 * Deletes the scheduled notifications for a specific warranty.
 * @param {string} warrantyId - The ID of the warranty
 */
export const deleteExpiryNotifications = async (warrantyId) => {
  const scheduleNames = [
    `expiry-7day-${warrantyId}`,
    `expiry-now-${warrantyId}`
  ];

  for (const name of scheduleNames) {
    try {
      const command = new DeleteScheduleCommand({ Name: name });
      await scheduler.send(command);
      console.log(`Successfully deleted schedule: ${name}`);
    } catch (error) {
      // Ignore if the schedule was already deleted or doesn't exist
      if (error.name !== "ResourceNotFoundException" && error.name !== "ResourceNotFound") {
        console.error(`Error deleting schedule ${name}:`, error);
      }
    }
  }
};
