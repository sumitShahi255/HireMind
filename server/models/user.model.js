import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
      name:{
            type : String,
            required : true,
            trim: true
      },
      email:{
            type : String,
            unique : true,
            required : true,
            trim: true,
            lowercase: true
      },
      credits:{
            type : Number,
            default : 100
      },
      headline:{
            type: String,
            default: "",
            trim: true
      },
      bio:{
            type: String,
            default: "",
            trim: true
      },
      phone:{
            type: String,
            default: "",
            trim: true
      },
      location:{
            type: String,
            default: "",
            trim: true
      },
      targetRole:{
            type: String,
            default: "",
            trim: true
      },
      experienceLevel:{
            type: String,
            default: "",
            trim: true
      },
      skills:{
            type: [String],
            default: []
      },
      githubUrl:{
            type: String,
            default: "",
            trim: true
      },
      linkedinUrl:{
            type: String,
            default: "",
            trim: true
      },
      portfolioUrl:{
            type: String,
            default: "",
            trim: true
      },
      avatarUrl:{
            type: String,
            default: "",
            trim: true
      }
},{timestamps : true})

const User = mongoose.model("User",userSchema);

export default User;