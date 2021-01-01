const Peer = require('simple-peer')
const socket = io('/chat')
const video = document.querySelector('video')
let clients = []
const constraintObj = {video: true, audio: true}
const meeting = JSON.parse(localStorage.getItem('meeting'))

const meeting_detail = {
  meeting_id: meeting.meeting._id,
  current_user: meeting.recipient._id
}

//GET VIDEO STREAM
navigator.mediaDevices.getUserMedia(constraintObj)
.then(stream => {
  video.load()
  socket.emit('newClient', meeting_detail)
  if ('srcObject' in video) {
    video.srcObject = stream 
  } else {
    video.src = window.URL.createObjectURL(stream)
  }
  playPromise =   video.play()
  if (playPromise !== undefined) {
    playPromise.then(_ => {
      console.log({first_media: video.srcObject}, 'PLAYING 1')
      // Automatic playback started!
    })
    .catch(error => {  
      console.log(error)
    });
  }
   
  // INITIALIZE A PEER
  function initPeer(type) {
    let init = false
    if(type === 'init') {
      init = true
    }
    let peer = new Peer({initiator: init, stream: stream, trickle: false})
    peer.on('stream', function (stream) {
      createVideo(stream)
    })
    return peer
  }

  function removeVideo () {
    document.getElementById('peerVideo').remove()
  }

  // MAKE PEER OF TYPE INIT
  function makePeer() {
    let client = {}
    client.gotAnswer = false
    let peer =  initPeer('init')

    peer.on('signal', (data) => {
      if (!client.gotAnswer) {
        socket.emit('offer', data)
      }
    })
    client.peer = peer
    clients.push(client)
  }

  // MAKE PEER OF TYPE NotInit 
  function frontAnswer (offer) {
    let peer = initPeer('notInit')
    peer.on('signal', (data) => {
      socket.emit('answer', data)
    })
    peer.signal(offer)
  }

  function signalAnswer (answer) {
    clients[0].gotAnswer = true
    let peer = clients[0].peer
    peer.signal(answer)
  }

  function createVideo (stream) {
    let video = document.createElement('video')
    video.load()
    video.id = 'peerVideo'
    if ('srcObject' in video) {
      video.srcObject = stream
    } else { 
      video.src = window.URL.createObjectURL(stream)
    }
    video.class = 'embed-responsive-item'
    document.querySelector('#peerDiv').appendChild(video)
    playPromise =   video.play()
    if (playPromise !== undefined) {
      playPromise.then(_ => {
        console.log({second_media: video.srcObject}, 'PLAYING 2')
        // Automatic playback started!
        // Show playing UI.
      }) 
      .catch(error => { 
        video.play()
        console.log(error) 
      });
    }
  }

  socket.on('backOffer', frontAnswer)
  socket.on('backAnswer', signalAnswer)
  socket.on('createPeer', makePeer)
  socket.on('removeVideo', removeVideo)   
})
.catch(err => {
  console.log({Error: err})
})

// const socket = io('/chat')
const app =  new Vue({
  el: '#App',
  data: {
    baseUrl: 'https://virtuallclass.herokuapp.com/',
    meeting: {},
    msg: '',
    messages: [],
    participants: [],
    user: '',
    generalMsg: null,
    userTyping: '',
    showParticipants: true,
    information: '',
    nav: {
      video: true,
      participants: false,
      chat: false
    }
  },
  methods: {
    toggleNav (view) {
      if (view === 'video') {
        this.nav.video = true
        this.nav.participants = false
        this.nav.chat = false
      } else if (view === 'participant') {
        this.nav.video = false
        this.nav.participants = true
        this.nav.chat = false
        this.showParticipants = true
      } else if (view === 'chat') {
        this.nav.video = false
        this.nav.participants = false
        this.nav.chat = true
        this.showParticipants = false
      }
    },

    newUser () {
      socket.emit('newUser', this.meeting)
    },
    
    initiateChat() {
      this.userTyping = ''
      socket.emit('finish', this.meeting.recipient.names)
      if (this.msg !== '') {
        const message = {
          sender: this.meeting.recipient.names,
          message: this.msg,
          meeting_id: this.meeting.meeting._id
        }
        this.messages.push(message)
        socket.emit('chat', message)
        this.msg =''
      }
    },
    
    typing(e) {
      if (e.keyCode !== 13) {
        socket.emit('typing', this.meeting.recipient.names)
      } else {
        this.userTyping = ''
        socket.emit('finish', this.meeting.recipient.names)
      }
    },
    
    leaveMeeting () {
      const participant = this.meeting.recipient._id
      const host = this.meeting.meeting.host
      const payload = {
        meeting: this.meeting.meeting._id,
        participant: participant
      }
      localStorage.removeItem('meeting')
      if (participant === host) {
        socket.emit('endMeeting', payload)
      } else {
        socket.emit('leaveMeeting', payload)
      }
      localStorage.setItem('meetingEnd', JSON.stringify(this.meeting.recipient.names))
      self.location = 'index.html'
    },
  },
  mounted() {
    socket.on('message', (data) => {
      this.messages = data
    })

    socket.on('userTyping', (data) => {
      this.userTyping = data
    })

    socket.on('userStoppedTyping', (data) => {
      this.userTyping = ''
    })

    socket.on('appendUser', (payload) => {
      this.participants = payload.participants
      this.messages = payload.chats
    })

    socket.on('userJoined', (msg) => {
      this.information = msg

      setTimeout(()=> {
        this.information = ''
      }, 3000)
    })
    socket.on('participantLeft', (data) => {
      this.participants = data.meetingParticipants
      this.information = data.message

      setTimeout(()=> {
        this.information = ''
      }, 3000)
    })

    socket.on('meetingEnded', (msg) => {
      localStorage.removeItem('meeting')
      localStorage.setItem('meetingEnd', JSON.stringify(this.meeting.recipient.names))
      self.location = 'index.html'
    })
  },

  created() {
    const user = localStorage.getItem('user')
    const meeting = localStorage.getItem('meeting')
    const constraintObj = {video: true, audio: true}
    if (meeting == null || user == null) {
      self.location = `${this.baseUrl}join_meeting`
    } else {
      (meeting !== null) ? this.meeting = JSON.parse(meeting) : self.location =  `${this.baseUrl}join_meeting`
      this.user = this.meeting.recipient.names
    }
    //NEW USER JOINED
    this.newUser()
  }
})

