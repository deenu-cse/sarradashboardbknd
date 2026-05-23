const Contact = require('../models/Contact');
const { validateString, validateEmail } = require('../middleware/validate.middleware');

// Public route to submit contact form
exports.createContact = async (req, res) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    // Simple validation
    if (!name || !email || !phone || !subject || !message) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ message: emailError });

    const newContact = await Contact.create({
      name,
      email,
      phone,
      subject,
      message,
      status: 'new'
    });

    res.status(201).json({
      success: true,
      message: 'Your message has been sent successfully.',
      data: newContact
    });
  } catch (error) {
    console.error('Contact Creation Error:', error);
    res.status(500).json({ message: 'Failed to send message. Please try again later.' });
  }
};

// Admin route to get all contacts
exports.getContacts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const contacts = await Contact.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Contact.countDocuments();

    res.status(200).json({
      success: true,
      data: contacts,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Fetch Contacts Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Admin route to update contact status (e.g. mark as read)
exports.updateStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['new', 'read', 'resolved'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const contact = await Contact.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    );

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.status(200).json({ success: true, data: contact });
  } catch (error) {
    console.error('Update Contact Status Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Admin route to delete a contact
exports.deleteContact = async (req, res) => {
  try {
    const { id } = req.params;
    const contact = await Contact.findByIdAndDelete(id);

    if (!contact) {
      return res.status(404).json({ message: 'Contact not found' });
    }

    res.status(200).json({ success: true, message: 'Contact deleted successfully' });
  } catch (error) {
    console.error('Delete Contact Error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};
