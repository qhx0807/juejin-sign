const miaotixing = require('./miaotixing.js')
const { MIAOTIXING_WEBHOOK } = require('../ENV.js')

const pushMessage = ({ message }) => {
  console.log(message)
  MIAOTIXING_WEBHOOK && console.log('发送通知...')
  MIAOTIXING_WEBHOOK && miaotixing(message)
}


module.exports = pushMessage