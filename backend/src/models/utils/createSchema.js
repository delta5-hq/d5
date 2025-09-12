import mongoose from 'mongoose'

const Schema = mongoose.Schema

const createSchema = (types, options = {}) => new Schema(types, {timestamps: true, ...options})

export default createSchema
