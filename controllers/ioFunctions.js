const Model = require('../model/schema')
const settings = require('./baseData')


module.exports.endMeeting = function(meeting) {
  try {
    Model.meetings.findOneAndUpdate(
      {_id: meeting.meeting},
      {
        status: settings.MEETING_STATUS.CLOSED,
        participants: []
      },
      {new: false}, async (err, data)=> {
        if (err) next(err)
        this.broadcast.emit('meetingEnded')
    })
  } catch (error) {
    console.log(error)
    next(error)
  }
}

module.exports.leaveMeeting = function async (payload)  {
  try {
    const msg = {
      message: '', 
      meetingParticipants: []
    }
    Model.meetings.findOne({ _id: payload.meeting }, async (err, data) => {
      if (err) return next(err)
      if (data) {
        let recipient = await Model.users.findOne({_id: payload.participant}, {password: false})
        msg.message = `${recipient.names} left`
        data.participants.splice(data.participants.indexOf(payload.participant), 1)
        const newMeetingData = await Model.meetings.findOneAndUpdate({_id: payload.meeting}, {participants: data.participants}, {new:true})
        for (user of newMeetingData.participants) {
          let recipient = await Model.users.findOne({_id: user}, {password: false})
          msg.meetingParticipants.push(recipient)
        }
        this.broadcast.emit('participantLeft', msg)
      } else {
        console.log({Error_Not_found: data})
      }
    })
  } catch (err) {
    console.log({Error: err})
    next(err)
  }
}

// CHAT FUNCTION
module.exports.broadcastMsg = async function (msg) {
  let newMessage = {
    sender: msg.sender,
    message: msg.message,
  }
  try {
    const meeting = await Model.meetings.findOne({ _id: msg.meeting_id })
    meeting.chats.push(newMessage)
    await Model.meetings
    .findOneAndUpdate(
      { _id: msg.meeting_id },
      {chats: meeting.chats},
      {new: true}, async (err, data) => {
        if (err) next(err)
        this.broadcast.emit('message', data.chats)
    }).catch((error) => {
      console.log(error)
    })
  } catch (error) {
    console.log(error)
    next(error)
  }
}

// VIDEO FUNCTIONS
module.exports.sendOffer = function (offer) {
  this.broadcast.emit('backOffer', offer)
}

module.exports.sendAnser = function (data) {
  this.broadcast.emit('backAnswer', data)
}