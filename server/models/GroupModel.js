const mongoose = require("mongoose");
const Mixed = mongoose.Schema.Types.Mixed;

const activitySchema = new mongoose.Schema({
    time: String,
    placeId: String,
    durationMinutes: Number,
    title: String,
    description: String,
    type: { type: String },
    tags: [String],
    slot: String,
    bestTime: [String],
    area: String,
    coordinates: Mixed,
    budgetTier: String,
    estimatedCost: Number,
    fatigueScore: Number,
    weatherSensitivity: String,
    score: Number,
    semanticScore: Number,
    source: String,
    selectionReason: String,
    adaptiveFitReason: String,
    retrievalReason: String,
    explanation: Mixed,
    scoreBreakdown: Mixed,
    semanticSignals: Mixed,
    regenerationMeta: Mixed,
    locked: Boolean
}, { _id: false });

const itineraryDaySchema = new mongoose.Schema({
    day: Number,
    title: String,
    subtitle: String,
    fatigueScore: Number,
    estimatedTravelMinutes: Number,
    date: String,
    activities: [activitySchema]
}, { _id: false });

const groupSchema = new mongoose.Schema({

    groupName: {
        type: String,
        required: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },

    image: {
        type: String,
        default: ""
    },

    joinCode: {
        type: String,
        unique: true
    },

    destination: {
        type: String,
        required: true
    },

    startDate: {
        type: Date,
        required: true
    },

    endDate: {
        type: Date,
        required: true
    },

    maxMembers: {
        type: Number,
        default: 1
    },

    members: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },
            role: {
                type: String,
                enum: ["admin", "member"],
                default: "member"
            }
        }
    ],

    type: {
        type: String,
        enum: ["solo", "group"],
        default: "solo"
    },

    proposals: [
        {
            text: String,

            type: {
                type: String,
                enum: ["modify","add","remove"]
            },

            target: String,
            after: String,

            createdBy: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            },

            status: {
                type: String,
                default: "pending"
            },

            upvotes: [],
            downvotes: []
        }
    ],

    // 🔥 ITINERARY
    itinerary: [itineraryDaySchema],

    aiPlanning: {
        type: Mixed,
        default: {}
    },

    adaptivePlanning: {
        type: Mixed,
        default: {}
    },

    regenerationHistory: {
        type: [Mixed],
        default: []
    },

    stabilitySnapshots: {
        type: [Mixed],
        default: []
    },

    explanationTraces: {
        type: [Mixed],
        default: []
    },

    userPreferences: {
        type: Mixed,
        default: {}
    }

}, { timestamps: true });


groupSchema.pre("save", function() {
    if (this.maxMembers > 1) {
        this.type = "group";
    } else {
        this.type = "solo";
    }
});

module.exports = mongoose.model("Group", groupSchema);
