const Group = require("../models/GroupModel");
const { regenerateItineraryWithAI } = require("../services/aiService");
const { getDestinationImage } = require("../../mock_ai_pipeline/data/destinationVisualAssets");

// 🔹 Generate unique join code
const generateUniqueCode = async () => {
    let code;
    let exists = true;

    while (exists) {
        code = Math.random().toString(36).substring(2, 8).toUpperCase();
        const group = await Group.findOne({ joinCode: code });
        if (!group) exists = false;
    }

    return code;
};

// ✅ CREATE GROUP
const createGroup = async (req, res) => {
    try {
        const { groupName, destination, startDate, endDate, maxMembers, planningPrompt } = req.body;

        if (!groupName || !destination || !startDate || !endDate) {
            return res.status(400).json({
                message: "All fields are required"
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        if (isNaN(start) || isNaN(end)) {
            return res.status(400).json({
                message: "Invalid dates"
            });
        }

        if (end < start) {
            return res.status(400).json({
                message: "End date must be after start date"
            });
        }

        const joinCode = await generateUniqueCode();

        const imageUrl = getDestinationImage(destination);

        const group = new Group({
            groupName,
            destination,
            startDate: start,
            endDate: end,
            joinCode,
            createdBy: req.user._id,
            image: imageUrl,
            maxMembers,
            type: maxMembers > 1 ? "group" : "solo",
            userPreferences: {
                planningPrompt: planningPrompt || ""
            }
        });

        group.members.push({
            user: req.user._id,
            role: "admin"
        });

        await group.save();

        res.json(group);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Group creation failed" });
    }
};

// ✅ JOIN GROUP
const joinGroup = async (req, res) => {
    try {
        let { code } = req.body;
        const userId = req.user._id;

        if (!code) {
            return res.status(400).json({ message: "Code is required" });
        }

        code = code.toUpperCase().trim();

        const group = await Group.findOne({ joinCode: code });

        if (!group) {
            return res.status(404).json({ message: "Invalid code" });
        }

        const alreadyMember = group.members.find(
            m => m.user.toString() === userId.toString()
        );

        if (alreadyMember) {
            return res.status(400).json({ message: "Already joined" });
        }

        if (group.members.length >= group.maxMembers) {
            return res.status(400).json({ message: "Group is full" });
        }

        group.members.push({
            user: userId,
            role: "member"
        });

        group.type = "group";

        await group.save();

        res.status(200).json({
            message: "Joined successfully",
            group
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
};

// ✅ GET MY GROUPS
const getMyGroups = async (req, res) => {
    try {
        const userId = req.user._id;

        const groups = await Group.find({
            "members.user": userId
        }).populate("members.user", "name email");

        res.json({ groups });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
};

const getJoinCode = async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        if (group.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Not authorized" });
        }

        res.json({ joinCode: group.joinCode });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Server error" });
    }
};

// ✅ GET GROUP BY ID
const getGroupById = async (req, res) => {
    try {
        const group = await Group.findById(req.params.id)
            .populate("members.user", "name email")
            .populate("createdBy", "name email")
            .populate("proposals.createdBy", "name email");

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        res.json(group);

    } catch (err) {
        console.log(err);
        res.status(500).json({ error: "Server error" });
    }
};

// ✅ ADD PROPOSAL
const addProposal = async (req, res) => {
    try {
        const { text } = req.body;

        const group = await Group.findById(req.params.id);

        group.proposals.push({
            text,
            createdBy: req.user._id
        });

        await group.save();

        const updated = await Group.findById(req.params.id)
            .populate("proposals.createdBy", "name email");

        res.json(updated.proposals);

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "Failed to add proposal" });
    }
};

// ✅ VOTE PROPOSAL
const voteProposal = async (req, res) => {
    try {
        const { proposalId, type } = req.body;
        const userId = req.user._id;

        const group = await Group.findById(req.params.id);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        const proposal = group.proposals.id(proposalId);

        if (!proposal) {
            return res.status(404).json({
                message: "Proposal not found"
            });
        }

        proposal.upvotes = proposal.upvotes.filter(
            id => id.toString() !== userId.toString()
        );

        proposal.downvotes = proposal.downvotes.filter(
            id => id.toString() !== userId.toString()
        );

        if (type === "up") proposal.upvotes.push(userId);
        if (type === "down") proposal.downvotes.push(userId);

        await group.save();

        res.json(proposal);

    } catch (err) {
        console.log("VOTE ERROR:", err);
        res.status(500).json({ message: "Voting failed" });
    }
};

// ✅ APPLY PROPOSALS + REGENERATE
const applyProposalsAndRegenerate = async (req, res) => {
    try {
        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        const updatedItinerary = await regenerateItineraryWithAI(group);

        group.itinerary = updatedItinerary;
        await group.save();

        res.json({
            message: "Itinerary updated successfully",
            itinerary: updatedItinerary
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({ message: "AI regeneration failed" });
    }
};

const approveProposal = async (req, res) => {
    try {
        const { proposalId } = req.body;

        const group = await Group.findById(req.params.id);

        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        if (group.createdBy.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                message: "Only host can approve proposals"
            });
        }

        const proposal = group.proposals.id(proposalId);

        if (!proposal) {
            return res.status(404).json({
                message: "Proposal not found"
            });
        }

        // ONLY mark approved
        proposal.status = "approved";

        await group.save();

        res.json({
            message: "Proposal approved",
            proposal
        });

    } catch (err) {
        console.log("APPROVE ERROR:", err);
        res.status(500).json({ message: err.message });
    }
};

const previewProposal = async (req,res)=>{
    try{

        const { proposalId } = req.body

        const group = await Group.findById(req.params.id)

        if (!group) {
            return res.status(404).json({ message: "Group not found" })
        }

        const proposal = group.proposals.id(proposalId)

        if (!proposal) {
            return res.status(404).json({ message: "Proposal not found" })
        }

        const match = await previewProposalMatch(group, proposal)

        res.json(match)

    }catch(err){
        console.log("PREVIEW ERROR:", err)
        res.status(500).json({message:err.message})
    }
};

const applyApprovedProposals = async (req,res)=>{
    try{

        const group = await Group.findById(req.params.id)

        if (!group) {
            return res.status(404).json({
                message: "Group not found"
            })
        }

        const approved =
            group.proposals.filter(
                p => p.status === "approved"
            )

        if(!approved.length){
            return res.json({
                itinerary: group.itinerary
            })
        }

        // IMPORTANT: clone group but only approved proposals
        const tempGroup = {
            ...group.toObject(),
            proposals: approved
        }

        // regenerate ONLY based on approved
        const updated =
            await regenerateItineraryWithAI(tempGroup)

        // remove approved proposals
        const remaining =
            group.proposals.filter(
                p => p.status !== "approved"
            )

        await Group.findByIdAndUpdate(
            req.params.id,
            {
                itinerary: updated,
                proposals: remaining
            }
        )

        res.json({
            itinerary: updated
        })

    }catch(err){
        console.log("APPLY ERROR:", err)
        res.status(500).json({message:err.message})
    }
};


const rejectProposal = async (req,res)=>{
    try{

        const { proposalId } = req.body

        const group = await Group.findById(req.params.id)

        if (!group) {
            return res.status(404).json({ message: "Group not found" })
        }

        const proposal = group.proposals.id(proposalId)

        if (!proposal) {
            return res.status(404).json({ message: "Proposal not found" })
        }

        proposal.status = "rejected"

        await group.save()

        res.json(proposal)

    }catch(err){
        console.log("REJECT ERROR:", err)
        res.status(500).json({message:err.message})
    }
}

module.exports = {
    createGroup,
    joinGroup,
    getMyGroups,
    getJoinCode,
    getGroupById,
    applyProposalsAndRegenerate,
    addProposal,
    voteProposal,
    approveProposal,
    previewProposal,
    applyApprovedProposals,
    rejectProposal
};
