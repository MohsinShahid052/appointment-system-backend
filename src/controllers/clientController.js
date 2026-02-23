import Client from "../models/Client.js";
import { encrypt, decrypt, hashPhone } from "../utils/crypto.js";
import mongoose from "mongoose";

// ----------------------------
// ADD / UPDATE CLIENT
// ----------------------------
export const upsertClient = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { name, phone, email, notes } = req.body;

    if (!name || !phone)
      return res.status(400).json({ message: "Name & phone are required" });

    const phoneHash = hashPhone(phone);

    // Check if client exists
    let client = await Client.findOne({
      barbershopId,
      phoneHash,
      isDeleted: false,
    });

    if (client) {
      // update existing
      client.encryptedName = encrypt(name);
      client.encryptedPhone = encrypt(phone);
      if (email) client.encryptedEmail = encrypt(email);
      client.notes = notes;
      await client.save();
    } else {
      // create new
      client = await Client.create({
        barbershopId,
        encryptedName: encrypt(name),
        encryptedPhone: encrypt(phone),
        encryptedEmail: email ? encrypt(email) : null,
        phoneHash,
        notes,
      });
    }

    // decrypt for response
    const result = {
      _id: client._id,
      name,
      phone,
      email,
      notes,
    };

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
};

// ----------------------------
// AUTO-FILL BY PHONE (hashed lookup)
// ----------------------------
export const findClientByPhone = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { phone } = req.query;

    if (!phone)
      return res.status(400).json({ message: "phone is required" });

    const phoneHash = hashPhone(phone);

    const client = await Client.findOne({
      barbershopId,
      phoneHash,
      isDeleted: false,
    });

    if (!client) return res.json({ found: false });

    res.json({
      found: true,
      client: {
        _id: client._id,
        name: decrypt(client.encryptedName),
        phone: decrypt(client.encryptedPhone),
        email: client.encryptedEmail ? decrypt(client.encryptedEmail) : null,
        notes: client.notes,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ----------------------------
// GET ALL CLIENTS (DECRYPTED)
// ----------------------------
export const listClients = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    
    if (!barbershopId) {
      return res.status(400).json({ message: "Barbershop ID is required" });
    }

    const docs = await Client.find({
      barbershopId: new mongoose.Types.ObjectId(barbershopId),
      isDeleted: false,
    });

    res.json(
      docs.map((c) => ({
        _id: c._id.toString(), // Ensure _id is a string
        name: decrypt(c.encryptedName),
        phone: decrypt(c.encryptedPhone),
        email: c.encryptedEmail ? decrypt(c.encryptedEmail) : null,
        notes: c.notes,
      }))
    );
  } catch (err) {
    next(err);
  }
};

// ----------------------------
// GET CLIENT BY ID
// ----------------------------
export const getClientById = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { id } = req.params;

    console.log(`[getClientById] Received request - ID: ${id}, BarbershopId: ${barbershopId}`);

    // Validate inputs
    if (!id) {
      console.log('[getClientById] Error: Client ID is missing');
      return res.status(400).json({ message: "Client ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      console.log(`[getClientById] Error: Invalid client ID format - ${id}`);
      return res.status(400).json({ message: "Invalid client ID format" });
    }

    if (!barbershopId) {
      console.log('[getClientById] Error: Barbershop ID is missing');
      return res.status(400).json({ message: "Barbershop ID is required" });
    }

    // Convert to ObjectId for query
    const clientObjectId = new mongoose.Types.ObjectId(id);
    const barbershopObjectId = new mongoose.Types.ObjectId(barbershopId);

    console.log(`[getClientById] Querying database - ClientId: ${clientObjectId}, BarbershopId: ${barbershopObjectId}`);

    // Find client
    const client = await Client.findOne({
      _id: clientObjectId,
      barbershopId: barbershopObjectId,
      isDeleted: false,
    }).lean();

    if (!client) {
      console.log(`[getClientById] Client not found in database`);
      // Check if client exists with different barbershop
      const anyClient = await Client.findById(clientObjectId).lean();
      if (anyClient) {
        console.log(`[getClientById] Client exists but belongs to different barbershop: ${anyClient.barbershopId}`);
      }
      return res.status(404).json({ 
        message: "Client not found",
        clientId: id,
        barbershopId: barbershopId.toString()
      });
    }

    console.log(`[getClientById] Client found successfully`);
    
    // Return decrypted client data
    return res.json({
      _id: client._id.toString(),
      name: decrypt(client.encryptedName),
      phone: decrypt(client.encryptedPhone),
      email: client.encryptedEmail ? decrypt(client.encryptedEmail) : null,
      notes: client.notes || null,
    });
  } catch (err) {
    console.error('[getClientById] Error:', err);
    return res.status(500).json({ 
      message: err.message || "Internal server error"
    });
  }
};

// ----------------------------
// PRIVACY DELETE (GDPR-like)
// ----------------------------
export const deleteClient = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { id } = req.params;

    const client = await Client.findOne({
      _id: id,
      barbershopId,
      isDeleted: false,
    });

    if (!client)
      return res.status(404).json({ message: "Client not found" });

    // Hard de-identification
    client.encryptedName = encrypt("Deleted Client");
    client.encryptedPhone = encrypt("0000000000");
    client.encryptedEmail = encrypt("deleted@example.com");
    client.phoneHash = hashPhone("0000000000");
    client.isDeleted = true;

    await client.save();

    res.json({ message: "Client anonymized" });
  } catch (err) {
    next(err);
  }
};
