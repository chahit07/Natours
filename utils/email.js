const nodemailer = require('nodemailer');
const pug = require('pug');
const { convert } = require('html-to-text');
require('dotenv').config(); // Loads .env file

// -----------------------
// Email class
// -----------------------
class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `CHAHIT from Natours <${process.env.EMAIL_FROM}>`;
  }

  transporter() {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USERNAME,
        pass: process.env.EMAIL_PASSWORD, // App password (not Gmail password)
      },
    });
  }

  async send(templateName, subject) {
    // Inline Pug templates
    const templates = {
      welcome: `
doctype html
html
  head
    title Welcome
  body
    h1 Hello #{firstName}!
    p Welcome to Natours! Click below to get started.
    a(href= url) Start Exploring`,
      passwordReset: `
doctype html
html
  head
    title Reset Password
  body
    h1 Reset Your Password
    p Hello #{firstName}, click below to reset your password.
    a(href= url) Reset Password`
    };

    const html = pug.render(templates[templateName], {
      firstName: this.firstName,
      url: this.url,
      subject,
    });

    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: convert(html),
    };

    try {
      await this.transporter().sendMail(mailOptions);
      console.log(`✅ Email sent to ${this.to}`);
    } catch (err) {
      console.error('❌ Error sending email:', err.message);
    }
  }

  async sendWelcome() {
    await this.send('welcome', 'Welcome to the Natours Family!');
  }

  async sendPasswordReset() {
    await this.send('passwordReset', 'Reset your Natours password');
  }
}



module.exports = Email









// const nodemailer = require('nodemailer');
// const pug = require('pug');
// const { convert } = require('html-to-text');

// module.exports = class Email {
//   constructor(user, url) {
//     this.to = user.email;
//     this.firstName = user.name.split(' ')[0];
//     this.url = url;
//     this.from = `CHAHIT from Natours <${process.env.EMAIL_FROM}>`;
//   }

//   transporter() {
//     if (process.env.NODE_ENV === 'production') {
//       // Mailgun
//       return nodemailer.createTransport({
//         host: process.env.MAILGUN_HOST,
//         port: process.env.MAILGUN_PORT,
//         auth: {
//           user: process.env.MAILGUN_USERNAME,
//           pass: process.env.MAILGUN_PASSWORD,
//         },
//       });
//     }

//     // Transporter object for "dev" environment
//     return nodemailer.createTransport({
//       host: process.env.EMAIL_HOST,
//       port: process.env.EMAIL_PORT,
//       auth: {
//         user: process.env.EMAIL_USERNAME,
//         pass: process.env.EMAIL_PASSWORD,
//       },
//     });
//   }

//   /**
//    * Send the actual email
//    * @param {string} template pug template like welcome, passwordReset, etc.
//    * @param {string} subject email subject line
//    */
//   async send(template, subject) {
//     // 1) Render HTML based on a pug template
//     const html = pug.renderFile(
//       `${__dirname}/../views/emails/${template}.pug`,
//       {
//         firstName: this.firstName,
//         url: this.url,
//         subject,
//       }
//     );
//     console.log(this.to);
    
//     // 2) Define the email options
//     const mailOptions = {
//       from: this.from,
//       to: this.to,
//       subject,
//       html,
//       text: convert(html, {
//         wordwrap: false,
//       }),
//     };

//     // 3) Create a transport and send email
//     try{
//       await this.transporter().sendMail(mailOptions);

//     }catch{
//       console.log("Error sending email");
//     }
//   }

//   async sendWelcome() {
//     await this.send('welcome', 'Welcome to the Natours Family');
//   }

//   async sendPasswordReset() {
//     console.log("*************************send 2*******************")
//     await this.send(
//       'passwordReset',
//       'Reset password instructions for Natours account'
//     );
//   }
// };

