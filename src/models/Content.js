import mongoose from 'mongoose'

const ContentSchema = new mongoose.Schema({
  contentId: String,
  contentOwnerId: String,
  steemUsername: String,
  steemPermlink: String
})

export default mongoose.model('Content', ContentSchema)
