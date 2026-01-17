const nodemailer = require('nodemailer');

async function sendMissedPunchInEmail(users) {
    console.log("<><>users",users);
    
  if (!users || users.length === 0) return;

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const list = users
    .map((u, i) => `${i + 1}. ${u.name} (${u.email})`)
    .join('<br/>');

  const html = `
    <h3>Missed Punch-In Report</h3>
    <p>The following users have not punched in today:</p>
    <br/>
    ${list}
    <br/><br/>
    <small>System generated – Attendance Module</small>
  `;

  await transporter.sendMail({
    from: '"Attendance System" <no-reply@company.com>',
    to: process.env.ADMIN_EMAIL,
    subject: 'Missed Punch-In Alert',
    html
  });
}

module.exports = { sendMissedPunchInEmail };
