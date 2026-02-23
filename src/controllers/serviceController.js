import Service from "../models/Service.js";
import ServiceCategory from "../models/ServiceCategory.js";

/**
 * Create service (barbershop-scoped)
 */
export const createService = async (req, res, next) => {
  try {
    const { name, description, price, duration, categoryId, metadata } = req.body;
    const barbershopId = req.barbershopId;  

    if (!name || price == null || duration == null || !categoryId)
      return res.status(400).json({ message: "name, price, duration, categoryId required" });

    // ensure category belongs to the same barbershop
    const cat = await ServiceCategory.findOne({ _id: categoryId, barbershopId });
    if (!cat) return res.status(400).json({ message: "Invalid category" });
if (!cat.isActive)
  return res.status(400).json({ message: "Category is inactive. Cannot add new services." });

    const service = await Service.create({
      barbershopId,
      categoryId,
      name,
      description,
      price,
      duration,
      metadata,
    });

    res.status(201).json(service);
  } catch (err) {
    next(err);
  }
};

export const getServices = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { categoryId, active } = req.query;

    const filter = { barbershopId };

    if (categoryId) {
      filter.categoryId = categoryId;
    }

    // Only apply active filter when query param is explicitly "true" or "false"
    if (active === "true") {
      filter.isActive = true;
    } else if (active === "false") {
      filter.isActive = false;
    }
    // if active is undefined → no isActive in filter → return all

    const services = await Service.find(filter)
      .sort({ name: 1 })
      .populate("categoryId", "name");

    res.json(services);
  } catch (err) {
    next(err);
  }
};

export const getServiceById = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { id } = req.params;

    const service = await Service.findOne({ _id: id, barbershopId }).populate("categoryId", "name");
    if (!service) return res.status(404).json({ message: "Service not found" });

    res.json(service);
  } catch (err) {
    next(err);
  }
};

export const updateService = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { id } = req.params;
    const updates = req.body;

    // If categoryId is being updated, ensure it belongs to shop
    if (updates.categoryId) {
      const cat = await ServiceCategory.findOne({ _id: updates.categoryId, barbershopId });
      if (!cat) return res.status(400).json({ message: "Invalid categoryId" });
    }

    const service = await Service.findOneAndUpdate({ _id: id, barbershopId }, updates, { new: true });
    if (!service) return res.status(404).json({ message: "Service not found" });

    res.json(service);
  } catch (err) {
    next(err);
  }
};

export const deleteService = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { id } = req.params;

    const service = await Service.findOne({
      _id: id,
      barbershopId,
      isActive: true
    });

    if (!service)
      return res.status(404).json({ message: "Service not found or already inactive" });

    service.isActive = false;
    await service.save();

    res.json({
      message: "Service deactivated successfully.",
      service
    });
  } catch (err) {
    next(err);
  }
};
export const restoreService = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { id } = req.params;

    const service = await Service.findOne({ _id: id, barbershopId });
    if (!service)
      return res.status(404).json({ message: "Service not found" });

    // Verify category is active or restore is blocked
    const category = await ServiceCategory.findById(service.categoryId);
    if (!category || !category.isActive)
      return res
        .status(400)
        .json({ message: "Cannot restore service because its category is inactive" });

    service.isActive = true;
    await service.save();

    res.json({
      message: "Service restored successfully.",
      service,
    });
  } catch (err) {
    next(err);
  }
};
