const express = require('express')
const upload_file = require('express-fileupload')
const dotenv = require('dotenv')
const mongoose = require('mongoose')

const app = express()
const http = require('http').Server(app)
const io = require ('socket.io')(http) 
// const bodyParser = require('body-parser');
dotenv.config()

const routes  = require('./router/routes')
const ioFunctions  = require('./controllers/ioFunctions')
const Model = require('./model/schema')

app.use(express.json());
app.use(upload_file())

//DATABASE CONNECTION
mongoose.connect(process.env.DB_CONNECT, {useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false}, (err) => {
  if(err) return console.log(`Error: ${err}`)
  console.log("We are connected")
})

app.use((req, resp, next) => {
  resp.header('Access-Control-Allow-Origin', '*')
  resp.header('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE')
  resp.header('Access-Control-Allow-headers', 'Content-type, Accept, x-access-token, x-key')

  if(req.method === 'OPTIONS') {
    resp.status(200).end()
  } else {
    next()
  }
})

app.use('/', routes)
app.use(express.static(__dirname + "/public"))
const chat = io.of('/chat')
const video = io.of('/video')
let clients = 0

chat.on('connection', function (socket) {
  // CHATTING FUNCTIONALITIES
  socket.on('newUser', sendNewUser)
  socket.on('chat', ioFunctions.broadcastMsg)
  socket.on('typing', (user) => {
    socket.broadcast.emit('userTyping', `${user} is typing...`)
  })
  socket.on('finish', (user) => {
    socket.broadcast.emit('userStoppedTyping', user)
  })
  socket.on('leaveMeeting', ioFunctions.leaveMeeting)
  socket.on('endMeeting', ioFunctions.endMeeting)

  // VIDEO FUNCTIONALITIES
  socket.on('newVideoClient', async function (payload) {
    const current_meeting = await Model.meetings.findOne({ _id: payload.meeting_id })
    console.log(current_meeting.participants)
    if (current_meeting.participants.length !== 1) {
      if (current_meeting.participants.indexOf(payload.current_user) < 0) {
        io.of('chat').emit('createPeer', {newUser: true})
        console.log("here comes the third client")
      } else {
        io.of('chat').emit('createPeer', {newUser: false})
      }
    }
  })
  socket.on('offer', ioFunctions.sendOffer)
  socket.on('answer', ioFunctions.sendAnser) 
  // socket.on('disconnect', ioFunctions.leaveMeeting)
})

//Custom Error Handler middleware
app.use((error, req, resp, next) => {
  resp.status(error.status || 500)
  resp.json({
    status: error.status,
    message: error.message,
    // stack: error.stack
  })
})

const port = process.env.PORT || 3000
http.listen(port, () => console.log(`Server active on port ${port}`))

// FUNCTIONS
const sendNewUser = async function  (payload) {
  try {
    let meetingPayload = {
      chats: [],
      participants:  [],
    }
    for (user of payload.meeting.participants) {
      let recipient = await Model.users.findOne({_id: user}, {password: false})
      meetingPayload.participants.push(recipient)
    }
    const current_meeting = await Model.meetings.findOne({_id: payload.meeting._id})
    meetingPayload.chats = current_meeting.chats
    io.of('chat').emit('appendUser', meetingPayload)
  } catch (error) {
    console.log(error)
  }
}