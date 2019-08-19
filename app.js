const config = {
  apiKey: `AIzaSyAR6ITxJ5W0KPi4khecgpZQV8dFc0tfjjM`,
  authDomain: `randomtestbed.firebaseapp.com`,
  databaseURL: `https://randomtestbed.firebaseio.com`,
  projectId: `randomtestbed`,
  messagingSenderId: `274147985197`,
  appId: `1:274147985197:web:7acaff8b54cf0bfc`
};

/* <--For dev testing you can use this config -->
  apiKey: `AIzaSyBtH7s4vDEgqOcdfTc0CGjQ2C07nxhM9hA`,
  authDomain: `browserstackappch.firebaseapp.com`,
  databaseURL: `https://browserstackappch.firebaseio.com`,
  projectId: `browserstackappch`,
  messagingSenderId: `1068441941356`,
  appId: `1:1068441941356:web:f502e11c0892377f`
*/

// TODO: Write a focus function that will call the DB and check the current accounts to ensure browser is up to date.

firebase.initializeApp(config);

// HTML element declarations
const addEmailButton = document.getElementById(`add-user-email`);
const accountInput = document.getElementById(`account-select`);
const appInstructions = document.getElementById(`app-instructions`);
const confirmModal = document.getElementById(`confirmModal`);
const db = firebase.database();
const emailInstructions = document.getElementById(`email-instructions`);
const faviconDefault = `assets/default.ico`;
const faviconWarn = `assets/warn.ico`;
const modalContinueSession = document.getElementById(`modalContinueSession`);
const modalEndSession = document.getElementById(`modalEndSession`);
const stopButton = document.getElementsByClassName(`stop-button`);
const useButton = document.getElementsByClassName(`use-button`);
const userEmailInput = document.getElementById(`user-email`);
const userNameInput = document.getElementsByClassName(`user-name-input`);
const waitListUI = document.getElementById(`wait-list`);

// Text declarations
const acctErrText = `Please choose an account to wait for!`;
const deleteText = `Delete`;
const dupeEmailErrText = `This email is already in the wait list!`;
const emailErrText = `Please enter a valid email!`;
const enterEmailText = `Enter your email to be notified when BrowserStack becomes available!`;
const enterNameText = `Please enter a name!`;
const inputDefaultText = `Enter your name to reserve this account!`;
/* 
This is where we create new accounts. After making the account in the HTML
adding and removing accounts is simple and automatic once added to the list below.
*/
const emailList = {
  qa: `awright@changehealthcare.com`,
  dev: `JuCarter@changehealthcare.com`
}
const keysArray = Object.keys(emailList);

// Color declarations
const errColor = `firebrick`;

// Global variable declarations
let dbValues;
let intervalObject = {};
let resetDBCalled = false;
let setTimeoutVar;
let timerStartValue = {};
let waitList;
let waitListKeys;

/* <<------------------ Event Handler Setup ------------------>> */
for (let i = 0; i < stopButton.length; i++) {
  stopButton[i].addEventListener(`click`, () => { stopUsingBrowserStack(stopButton[i]) });
}

for (let i = 0; i < useButton.length; i++) {
  useButton[i].addEventListener(`click`, () => { beginUsingBrowserStack(useButton[i]) });
}

for (let i = 0; i < userNameInput.length; i++) {
  userNameInput[i].addEventListener(`keyup`, (event) => {
    if (event.keyCode === 13) {
      beginUsingBrowserStack(userNameInput[i]);
    }
  })
}

userEmailInput.addEventListener(`keyup`, (event) => {
  if (event.keyCode === 13) {
    addToWaitList();
  }
});

document.onreadystatechange = () => {
  if (document.readyState === `complete`) {
    init();
  }
}

addEmailButton.addEventListener(`click`, addToWaitList);

/* <<------------------ Init Fires on FB Update ------------------>> */
/* Fires on start & each time FB updates one of the watched paths.
Making it real time. If no data exists set default values in DB. */
function init() {
  db.ref(`accounts`).on(`value`, snap => {
    const accountKeys = Object.keys({ ...snap.val() });
    dbValues = snap.val();
    if (keysArray.length != accountKeys.length) {
      // If the local array is different than the DB values, reset the DB values.
      resetDefaultDBValues();
    } else if (snap.val()) {
      accountKeys.forEach(function (key) {
        if (dbValues[key].isActive) {
          setActive(key);
        } else {
          setInActive(key);
        }
      })
    }
  });

  db.ref(`waitList`).on(`value`, snap => {
    if (snap.val()) {
      waitList = snap.val().waitList;
      waitListKeys = snap.val().waitListKeys;
      createList(waitList, waitListKeys);
    } else {
      waitList = [];
      waitListKeys = [];
      createList(waitList, waitListKeys);
    }
  });
}

function resetDefaultDBValues() {
  // Global var to make sure it is only called once to prevent loop.
  if (!resetDBCalled) {
    resetDBCalled = true;
    db.ref(`accounts`).remove();
    keysArray.forEach((key) => {
      updateAccounts(false, ``, 0, key, false);
    })
  }
}

/* <<------------------ User Actions ------------------>> */
function beginUsingBrowserStack(useButton) {
  const key = useButton.id.split(` `)[1];
  const appInstructions = document.getElementById(`app-instructions ${key}`);
  const userNameInput = document.getElementById(`user-name ${key}`).value;

  startTime = getSystemTime();
  // Set the username as a check later for alerts.
  localStorage.setItem(`userName`, userNameInput);

  if (userNameInput === ``) {
    appInstructions.innerHTML = `${enterNameText}`;
    appInstructions.style.color = `${errColor}`;
  } else {
    appInstructions.style.color = ``;
    updateAccounts(true, userNameInput, startTime, key, false);
  }
}

function stopUsingBrowserStack(stopButton, accountKey) {
  const key = stopButton ? stopButton.id.split(` `)[1] : accountKey;
  const activeTimer = document.getElementById(`active-timer ${key}`);
  const activeUser = dbValues[key].activeUser;
  const formattedTime = activeTimer.innerHTML.replace(/&nbsp;/g, ` `);
  const formattedString = `${formattedTime} using ${key}'s account`;

  // Prevents blank logs, this function fires on all browsers running the app when a user logs off.
  if (formattedTime !== ``) {
    updateLogs(activeUser, formattedString);
  }

  // Prevents redundant logs, see above comment.
  if (dbValues[key].isActive === true) {
    updateAccounts(false, ``, 0, key, false);
  }

  // Decouple user from site, and reset start time.
  delete timerStartValue[key];
  localStorage.removeItem(`userName`);
}

function addToWaitList() {
  const emailInput = userEmailInput.value;
  const emailRegex = /(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])/g;

  let accountInputError = ``;
  let emailError = ``;

  // Checks for email legitimacy & accountInput has a value. If both fail, show both error messages.
  if (emailInput.match(emailRegex) && accountInput.value) {
    // Checks if email already exists in the que. If fails show error state.
    if (waitList.indexOf(emailInput) === -1) {
      waitList.push(userEmailInput.value);
      waitListKeys.push(accountInput.value);
      userEmailInput.value = ``;
      accountInput.value = ``;
      emailInstructions.innerHTML = `${enterEmailText}`;
      emailInstructions.style.color = ``;
      updateWaitList(waitList, waitListKeys);
    } else {
      emailInstructions.innerHTML = `${dupeEmailErrText}`;
      emailInstructions.style.color = `${errColor}`;
    }
  } else {
    if (!accountInput.value) {
      accountInputError = `${acctErrText}`;
    }
    if (!emailInput.match(emailRegex)) {
      emailError = `${emailErrText}`;
    }
    emailInstructions.innerHTML = `${emailError} ${accountInputError}`;
    emailInstructions.style.color = `${errColor}`;
  }
}

// Removes the selected email from dom lists and saves to DB.
function deleteFromWaitList() {
  waitList.splice(this.value, 1);
  waitListKeys.splice(this.value, 1);
  updateWaitList(waitList, waitListKeys);
}

/* <<------------------ App Functions ------------------>> */
// Updates to the DOM should happen in setActive & setInActive to propagate changes for all users.
// Runs each time init is called from the DB updating accounts path for each active tracker.
function setActive(key) {
  const activeDiv = document.getElementById(`active-status ${key}`);
  const activeUser = dbValues[key].activeUser;
  const stopButton = document.getElementById(`stop-button ${key}`);
  const useButton = document.getElementById(`use-button ${key}`);
  const userNameInput = document.getElementById(`user-name ${key}`);

  let accountName = key.split(``);

  // Sets first letter to Uppercase. Might find a better solution in css.
  accountName.splice(0, 1, accountName[0].toUpperCase())
  accountName = accountName.join(``);
  startTime = dbValues[key].startTime;

  activeDiv.innerHTML = `${activeUser} is using ${accountName}'s BrowserStack account`;
  stopButton.disabled = false;
  useButton.disabled = true;
  userNameInput.disabled = true;
  userNameInput.value = ``;

  addEmailAndCopyButton(key);
  startTimer(startTime, key);
}

// Runs each time init is called from the DB updating accounts path for each inactive tracker.
function setInActive(key) {
  if (key !== undefined) {
    const activeDiv = document.getElementById(`active-status ${key}`);
    const activeTimer = document.getElementById(`active-timer ${key}`);
    const appInstructions = document.getElementById(`app-instructions ${key}`);
    const stopButton = document.getElementById(`stop-button ${key}`);
    const useButton = document.getElementById(`use-button ${key}`);
    const userNameInput = document.getElementById(`user-name ${key}`);

    // If the HTML does not exist then skip it. 
    if (activeDiv) {
      activeDiv.innerHTML = `${key}'s BrowserStack account is available!`;
      // Sets height to prevent jumping boxes.
      activeTimer.style.height = ``;
      activeTimer.innerHTML = ``;
      appInstructions.innerHTML = `${inputDefaultText}`;
      stopButton.disabled = true;
      useButton.disabled = false;
      userNameInput.disabled = false;

      addEmailAndCopyButton(key);
      // Clears interval from the active tracker based on unique ID.
      clearInterval(intervalObject[key]);
    }
  }
}

// Adds email ques to the end of instructions. Copy button appended for ease of use.
function addEmailAndCopyButton(key) {
  const activeDiv = document.getElementById(`active-status ${key}`);
  const extraText = document.createElement(`h6`);

  extraText.innerHTML = `(${emailList[key]})`;
  extraText.id = `emailText`;
  activeDiv.appendChild(extraText);
  // Set copy button and append
  const button = document.createElement(`button`);
  button.addEventListener(`click`, () => {
    setClipboard(emailList.key)
  });
  button.id = `copyButton`;
  button.innerHTML = `copy`;

  extraText.appendChild(button);
}

// Sets then removes a hidden input that copies the selected email.
function setClipboard(value) {
  const input = document.createElement(`input`);

  input.style = `left: -500em; top: -500em; position: absolute;`;
  document.body.appendChild(input);
  input.value = value;
  input.select();
  document.execCommand(`copy`);
  document.body.removeChild(input);
}

// Init the timer and set the starting value.
function startTimer(startTime, key) {
  const activeTimer = document.getElementById(`active-timer ${key}`);
  const appInstructions = document.getElementById(`app-instructions ${key}`);
  const initTime = Date.now();

  // If the key does not exist on timerStartValue then create it.
  if (!timerStartValue[key]) {
    timerStartValue[key] = {
      isActive: false,
      value: Math.floor((initTime - startTime) / 1000)
    }
  }

  // If the timer has already been started do not call incrementTimer again
  if (dbValues[key].isActive && !timerStartValue[key].isActive) {
    /* We remove the Loading text and set the height to prevent jumping
    at this stage because we want to preserve the loading state until the
    app is fully ready to display the counter. */
    appInstructions.innerHTML = ``;
    activeTimer.style.height = `15px`;

    timerStartValue[key].isActive = true;
    /* Sets the unique interval id to an object bound by the key.
    We need this later to call clearInterval for this timer. */
    intervalObject[key] = setInterval(incrementTimer, 1000, key);
  }
}

/* Add 1 every second to the timer value & display. 
Runs every second until clearInterval is called on intervalObject[key] */
function incrementTimer(key) {
  const activeTimer = document.getElementById(`active-timer ${key}`);

  if (timerStartValue[key]) {
    ++timerStartValue[key].value;
    activeTimer.innerHTML = formatTimer(timerStartValue[key].value);
    // Run a check to see if the user has been reminded they have been logged for over 1.5 hours.
    checkTimeAndAlert(timerStartValue[key].value, key);
  }
}


function checkTimeAndAlert(seconds, key) {
  // We are using a modal instead of an alert as it is non-blocking and allows timeout of the modal message.
  const storedUser = localStorage.getItem(`userName`);
  const userValues = dbValues[key];

  // Every 1.5 hours if the user is the same as the active user and they have not seen the modal then we display the Expiration modal.
  if (seconds > 5400 && seconds % 5400 < 900 && dbValues[key].activeUser === storedUser && userValues.seenModalBool === false) { // 5,400 seconds is 1.5 hours + within 15 min
  // if (seconds % 5400 === 0 && dbValues[key].activeUser === storedUser) { // 5,400 seconds is 1.5 hours.
    // Open Modal
    confirmModal.style.display = `block`;
    // Switch to warn favicon
    document.getElementById(`favicon`).href = faviconWarn;

    updateAccounts(true, userValues.activeUser, userValues.startTime, key, true)

    // Start a 15 minute timer and change favicon.
    setTimeoutForModalExpiration(key);

    modalContinueSession.addEventListener(`click`, () => {
      setDefaultFaviconCloseModalClearExpirationTimeout();
    });

    modalEndSession.addEventListener(`click`, () => {
      setDefaultFaviconCloseModalClearExpirationTimeout();
      stopUsingBrowserStack(null, key);
    });
    // if the user is not in a modal window we should reset the seenModalBool to set up the next check.
  } else if (seconds > 5400 && seconds % 5400 > 900 && userValues.seenModalBool === true) {
    updateAccounts(true, userValues.activeUser, userValues.startTime, key, false);
  }
}

function setDefaultFaviconCloseModalClearExpirationTimeout() {
  document.getElementById(`favicon`).href = faviconDefault;
  confirmModal.style.display = `none`;
  clearTimeout(setTimeoutVar);
}

// TODO: Move/copy this logic to cloud functions. I think we need to set a reset bool on the account.
// TODO: If the user does not see the modal or click to extend we need to set the account to inactive.
// TODO: We could also use the start time in the DB to display how long until auto logout seconds % 5400 +15 min
// TODO: If we leave the FE logic in place we could use to bool to make sure the modal has been seen or not. 
// TODO: If the modal has not been seen because JS was paused we can add a check in checkTimeAndAlert to alert and display countdown.
// If the user makes no selection within 15 minutes the session will be ended for them.
function setTimeoutForModalExpiration(key) {
  setTimeoutVar = setTimeout(() => {
    setDefaultFaviconCloseModalClearExpirationTimeout();
    stopUsingBrowserStack(null, key);
  }, 9000000); // 900,000 is 15 minutes.
}

// Format time to human readable string.
function formatTimer(time) {
  const stringStart = `For&nbsp;`;

  let seconds;
  let minutes;
  let hours;
  let stringSeconds = `&nbsp;seconds`;
  let stringMinutes = ``;
  let stringHours = ``;

  if (time > 7200) {
    seconds = time % 60;
    minutes = Math.floor((time % 3600) / 60);
    hours = Math.floor(time / 3600);
    stringMinutes = `&nbsp;minutes&nbsp;and&nbsp;`;
    stringHours = `&nbsp;hours&nbsp;and&nbsp;`;
  } else if (time > 3600) {
    seconds = time % 60;
    minutes = Math.floor((time % 3600) / 60);
    hours = Math.floor(time / 3600);
    stringMinutes = `&nbsp;minutes&nbsp;and&nbsp;`;
    stringHours = `&nbsp;hour&nbsp;and&nbsp;`;
  } else if (time > 120) {
    seconds = (time % 60);
    minutes = Math.floor(time / 60);
    hours = ``;
    stringMinutes = `&nbsp;minutes&nbsp;and&nbsp;`;
  } else if (time > 60) {
    seconds = (time % 60);
    minutes = Math.floor(time / 60);
    hours = ``;
    stringMinutes = `&nbsp;minute&nbsp;and&nbsp;`;
  } else {
    seconds = time;
    minutes = ``;
    hours = ``;
    time == 1 ? stringSeconds = `&nbsp;second` : null;
  }

  return stringStart + hours + stringHours + minutes + stringMinutes + seconds + stringSeconds;
}

// Return human readable date string.
function getCurrentDate() {
  const date = new Date();

  let day = date.getDate();
  let month = date.getMonth() + 1;
  let year = date.getFullYear();

  day < 10 ? day = `0${day}` : null;
  month < 10 ? month = `0${month}` : ``;

  return `${month}-${day}-${year}`;
}

function getSystemTime() {
  return Date.now();
}

// Draws email list items to DOM with delete buttons. Rewrites after DB update to wait-list.
function createList(array) {
  const list = document.createElement(`ul`);

  if (array) {
    for (var i = 0; i < array.length; i++) {
      const button = document.createElement(`button`);

      button.addEventListener(`click`, deleteFromWaitList);
      button.id = `delete-email-button`
      button.innerHTML = `${deleteText}`;
      button.value = i;

      const listItem = document.createElement(`li`);

      listItem.appendChild(button);
      listItem.appendChild(document.createTextNode(`${i + 1}. ${array[i]} for ${waitListKeys[i]}'s account`));
      list.appendChild(listItem);
    }
    waitListUI.appendChild(list);

    /* Clears old waitList when createList is called by FB with an updated list.
    Since we already appended our new list and we know a list exists we can
    safely remove the old list from the dom. */
    if (waitListUI.children.length !== 1) {
      waitListUI.firstChild.remove();
    }
  }
}

/* <<------------------ Calls to Firebase ------------------>> */
/*
Any changes made to the updateAccounts function will cause firebase to fail 
and requires dropping the DB.
This presents a problem as the DB detects a change on DB drop and any open instance
of the site that has an older version will trigger their update functions.
We can force version control on JS but we can't force a refresh.

Until fix is found is best to deploy changes that will need a DB drop during 
off hours.
*/
function updateAccounts(activeBool, string, number, id, seenModal) {
  if (id !== ``) {
    db.ref(`accounts/${id}`).set({
      activeUser: string,
      isActive: activeBool,
      startTime: number,
      seenModalBool: seenModal
    }, (error) => {
      if (error) {
        console.warn(`error updating FB accounts`);
      } else {
        console.log(`success updating accounts`);
      }
    });
  }
}

function updateWaitList(array, waitListKeys) {
  db.ref(`waitList`).set({
    waitList: array,
    waitListKeys: waitListKeys
  }, (error) => {
    if (error) {
      console.warn(`error updating FB waitList`);
    } else {
      console.log(`success updating waitList`);
    }
  });
}

function updateLogs(activeUser, timerString) {
  const dateToday = getCurrentDate();
  const loggedTime = getSystemTime();
  db.ref(`logs/${dateToday}/${activeUser}-${timerString}`).set({
    user: activeUser,
    timeUsed: timerString,
    loggedTime: loggedTime
  }, (error) => {
    if (error) {
      console.warn(`error writing to FB logs`);
    } else {
      console.log(`success writing to logs`);
    }
  });
}
