let wt = new WarpTalk("wss", "warp.cs.au.dk/talk/");
let availableRoomsList, room, nickname, listenersAttached = false;
let joinedRooms = new Set();
// let users = [];
let chatRoomsStates = []; // TODO add the functionality of saving room states(messages and notifications)

wt.isLoggedIn(function (isLoggedIn) {
  if (isLoggedIn) {
    // If we are already logged in we can call connect that we also give a function to call when the connection has been established
    wt.connect(connected);
  } else {
    // If not, we prompt the user for a temporary unregistered nickname
    nickname = prompt("What's your (unregistered) nickname?");
    wt.connect(connected, nickname);
  }
});

// function isCurrentRoom(r){
//   if(room === r)
//     return;
// }

function clearChat(){
    const chatMessagesContainer = document.getElementsByClassName("chat-messages")[0];
    chatMessagesContainer.replaceChildren();
}

function joinRoom(r) {
  if(typeof room === "undefined" || room.name !== r.name){
    room = wt.join(r.name);
    updateUsers(room);
    clearChat();
    console.log("Now you are in the room " + room.name);
    document.getElementById("chat-room-name").textContent = room.name;

    if(!joinedRooms.has(r.name)){
    room.onMessage((room, msg) => {
      const chatMessagesContainer = document.getElementsByClassName("chat-messages")[0];
      console.log(`${room.name} - ${msg.sender}: ${msg.message}`);
      var currentdate = new Date();
      const messageDiv = document.createElement("div");
      messageDiv.classList.add("message");
      const messageSender = document.createElement("div");
      messageSender.classList.add("sender")
      
      const messageSenderName = document.createElement("span");
      messageSenderName.classList.add("sender-name");
      messageSenderName.textContent = "@" + msg.sender;

      const messageContentDiv = document.createElement("div");
      messageContentDiv.classList.add("message-content");
      const messageTextDiv = document.createElement("div");
      messageTextDiv.classList.add("message-text");
      const timeStamp = document.createElement("p");
      timeStamp.textContent = currentdate.getHours() + ":"  + currentdate.getMinutes()
      timeStamp.classList.add("timestamp");
      if (msg.sender === nickname) {
        messageDiv.classList.add("sent");
      } else {
        messageDiv.classList.add("received");
      }
      const messageText = document.createElement("p");
      messageText.textContent = msg.message;
      
      messageSender.appendChild(messageSenderName)
      if(msg.sender != nickname)
      messageContentDiv.appendChild(messageSender);

      messageTextDiv.appendChild(messageText)
      messageTextDiv.appendChild(timeStamp)
      messageContentDiv.appendChild(messageTextDiv)
      messageDiv.appendChild(messageContentDiv);
      chatMessagesContainer.appendChild(messageDiv);
    });

    // every time a user joins the room creates a notification and a div for it to display in the chat container
    room.onJoin((room, nickname) => {
      const chatMessagesContainer = document.getElementsByClassName("chat-messages")[0];
      console.log(`${nickname} joined ${room.name}`);
      document.getElementById("chat-room-name").textContent = room.name

      updateUsers(room);
        const messageNotification = document.createElement('div');
        messageNotification.classList.add('message-notification');
        const messageNotificationText = document.createElement('p');
        messageNotificationText.textContent = nickname + ' has joined ' + room.name;
        messageNotification.appendChild(messageNotificationText)
        chatMessagesContainer.appendChild(messageNotification);
    });

    // every time a user leaves the room creates a notification and a div for it to display in the chat container
    room.onLeave((room, nickname) => {
        const chatMessagesContainer = document.getElementsByClassName("chat-messages")[0];
      console.log(`${nickname} left ${room.nickname}`);
      
      updateUsers(room);
        const messageNotification = document.createElement('div');
        messageNotification.classList.add('message-notification');
        const messageNotificationText = document.createElement('p');
        messageNotificationText.textContent = nickname + ' has leaved ' + room.name;
        messageNotification.appendChild(messageNotificationText)
        chatMessagesContainer.appendChild(messageNotification);
    });

    room.onDisconnect((room) => {
      console.log(`Connection to server lost`);
    });

    window.send = function (msg) {
      room.send(msg);
    };
    window.login = function (username, password) {
      wt.login(username, password);
    };
    window.logout = function () {
      wt.logout();
    };
  
  joinedRooms.add(r.name)  
    }
  }
}


// creates the side bar with the list of rooms as buttons
function connected() {
  console.log("Connection established.");
  console.log(wt.availableRooms);
  const contactList = document.getElementById("contact-list");
  availableRoomsList = wt.availableRooms;

  if (wt.availableRooms && wt.availableRooms.length > 0) {
      console.log("The server has the following rooms:");
    availableRoomsList.forEach((r) => {
      const contactButton = document.createElement("button");
      contactButton.classList.add("contact");
      contactButton.addEventListener("click", () => {
        joinRoom(r);
      });
      const buttonText = document.createTextNode(r.name);
      contactButton.appendChild(buttonText);
      contactList.appendChild(contactButton);
    });

    setInitialRoom(wt.availableRooms[0]);
    
    // for every sent message, either our or of other users, creates the a div for it to display in the chat container

  } else {
    console.log("No available rooms. From connected");
  }
}

function setInitialRoom(initialRoom) {
  room = joinRoom(initialRoom);
  if (room) {
    room.send("Hello, room!");
    console.log("Now you are in the room " + room.name);
  }
}

connected();




// update the list of users when they leave or join the chat
function updateUsers(room) {
  let users = [];
  // Check if room and room.clients are defined before trying to access them
  if (room && room.clients) {
    room.clients.forEach(client => {
      users.push(client.nickname);
    });
  }
  const userListString = users.join(", ");
  const userList = document.getElementById("user-list");
  console.log("users are    " + users)
  userList.textContent = "";
  userList.textContent = userListString;
}
