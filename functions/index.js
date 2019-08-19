const functions = require('firebase-functions');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');

// Set to and from emails for nodemailer
const mailTransport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'browserstackautobot@gmail.com',
    pass: 'runkmbzrvshlueru',
  },
});
const APP_NAME = 'BrowserStack Bot';
let waitList = [];
let waitListKeys = [];

admin.initializeApp();

/* <----------- DB references -----------> */

// Watches reference on FB accounts and fires on change.
exports.activeUserChanged = functions.database.ref('/accounts')
  .onWrite((change) => {
    let userWentInactive = false;
    let beforeActiveUser;
    let beforeStartTime;
    let changedAccount;

    const changeBefore = change.before._data;
    // Compare before and new data, if the user has logged out we move on.
    Object.keys(changeBefore).forEach((key) => {
      if ((changeBefore[key].activeUser !== '') && (change.after._data[key].activeUser === '')) {
        userWentInactive = true;
        beforeActiveUser = changeBefore[key].activeUser;
        beforeStartTime = changeBefore[key].startTime;
        changedAccount = key;
      }
    })
    // We grab the waitlist from FB and check if it has records. 
    admin.database().ref('waitList').once('value').then((snapshot) => {
      if (snapshot.exists()) {
        waitList = snapshot.val().waitList;
        waitListKeys = snapshot.val().waitListKeys;
      }
      if ((userWentInactive) && waitList.length !== 0) {

        // TODO: Add check to see what account is requested in the waitlist before we send the email.
        sendReminderEmail(waitList, waitListKeys, beforeActiveUser, beforeStartTime, changedAccount);
        // Not sure why we are returning here.
        return true;
      } else {
        return null;
      }
    }).catch(error => {
      console.error(error);
    });
    return null;
  });

// PLAN: Move log out functionality from the FE to the cloud function so we don't have browser execution problems.
// Currently the browser will pause the JS from executing if the user hasn't been to the tab in a while, rendering the FE 
// log out logic useless.

// We will have to fire when the user starts the session, unknown if cloud funcitons have a execution timeout,
// but we need to keep track of timers here as the FE is unreliable. 
exports.activeUserChanged = functions.database.ref('/accounts')
  .onWrite((change) => {
    let userWentActive = false;
    let changedAccount;

    const changeAfter = change.after._data;
    // Compare before and new data, if the user has logged in we move on.
    Object.keys(changeBefore).forEach((key) => {
      if ((changeBefore[key].activeUser === '') && (change.after._data[key].activeUser !== '')) {
        userWentActive = true;
        startTime = changeAfter[key].startTime;
        changedAccount = key;
      }
    })
    // Start timer, if the user has flipped the seenModal bool to true we should not do anything.
    // We should be checking for the flipped bool under the following conditions:
    // If seenModal is false after 1.5 hours + 15 min we want to set the account to inactive.


    return null;
  });


/* <----------- Actions -----------> */

function sendReminderEmail(waitListArray, waitListKeys, beforeName, startTime, changedAccount) {
  const upperCaseWaitListKeys = [];
  waitListKeys.forEach((key) => { upperCaseWaitListKeys.push(key.toUpperCase()) })
  const indexOfChangedAccountEmail = upperCaseWaitListKeys.indexOf(changedAccount.toUpperCase());
  const email = waitListArray[indexOfChangedAccountEmail];
  const mailOptions = {
    from: `${APP_NAME} <browserstackautobot@gmail.com>`,
    to: email,
  };
  const currentTime = Date.now();
  const hours = Math.floor((currentTime - startTime) / 3600000);
  const shortText = `finally,`;
  const longText = `after only ${hours} hours ...`;

  let shownText = shortText;
  let accountName = changedAccount.split('');
  accountName.splice(0, 1, accountName[0].toUpperCase())
  accountName = accountName.join('');

  // Show sassy text if the last person took forever.
  if (hours > 2) {
    shownText = longText;
  }

  mailOptions.subject = `${APP_NAME} Reminder!`;
  mailOptions.text = `Hey there!\nJust wanted to let you know ${beforeName} is done using ${accountName}'s BrowserStack account ${shownText} and now it is YOUR TURN!\n\nI know this is really exciting, (it is for us too trust me) but please don't forget to sign in with the link below!\n\nHave a great day!\nMuch Love,\nE-Vizzle && E-Dizzle\n\nhttps://assets.staging.changehealthcare.com/testing/browserstack_tracker/index.html`;

  if (indexOfChangedAccountEmail !== -1) {
    mailTransport.sendMail(mailOptions);
    console.log('Sending email to: ', email);
    updateWaitList(waitListArray, waitListKeys, indexOfChangedAccountEmail);
  }
}

// Removes the first instance of the waitlist after the email has been sent. 
// TODO: Update to remove the account requested rather than the first instance.
function updateWaitList(waitListArray, waitListKeys, indexOfChangedAccountEmail) {
  waitListArray.splice(indexOfChangedAccountEmail, 1);
  waitListKeys.splice(indexOfChangedAccountEmail, 1);
  admin.database().ref('waitList').set({
    waitList: waitListArray,
    waitListKeys: waitListKeys
  }, (error) => {
    if (error) {
      console.log(`error updating FB waitList`);
    } else {
      console.log(`success updating waitList`);
    }
  });
}
