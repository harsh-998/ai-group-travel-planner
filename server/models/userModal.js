const mongoose = require("mongoose");
const Mixed = mongoose.Schema.Types.Mixed;

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    adaptivePreferenceProfile: {
        type: Mixed,
        default: {}
    },
    behaviorSignals: {
        type: [Mixed],
        default: []
    }
}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
