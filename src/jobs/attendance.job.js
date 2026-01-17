const { getUsersWithoutPunchIn } = require("../services/attendance.service");
const { sendMissedPunchInEmail } = require("../services/email.service");

async function runAttendanceCheck(startTime) {
  const users = await getUsersWithoutPunchIn(startTime);

  if (users.length === 0) {
    console.log('[ATTENDANCE] All users punched in');
    return;
  }

  console.log(`[ATTENDANCE] ${users.length} users missed punch-in`);

  await sendMissedPunchInEmail(users);
}

module.exports = { runAttendanceCheck };
