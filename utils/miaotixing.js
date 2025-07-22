const axios = require('axios')
const { MIAOTIXING_WEBHOOK } = require('../ENV.js')

const miaotixing = async (text) => {
  try {
    await axios.get(MIAOTIXING_WEBHOOK+text).then(response => {
      if (response?.data?.StatusCode !== 0) {
        throw new Error(response?.data?.msg)
      }
    })
  } catch (error) {
    console.log(error.stack)
  }
}

module.exports = miaotixing
