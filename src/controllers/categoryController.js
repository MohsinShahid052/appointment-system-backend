import ServiceCategory from "../models/ServiceCategory.js";
import Service from "../models/Service.js";

/**
 * Create a new category (barbershop-scoped).
 * Protected route + tenant middleware should set req.barbershopId
 */
export const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const barbershopId = req.barbershopId;

    if (!name) return res.status(400).json({ message: "Category name is required" });

    const existing = await ServiceCategory.findOne({ barbershopId, name });
    if (existing) return res.status(409).json({ message: "Category already exists" });

    const cat = await ServiceCategory.create({ barbershopId, name, description });
    res.status(201).json(cat);
  } catch (err) {
    next(err);
  }
};

export const getCategories = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const categories = await ServiceCategory.find({ barbershopId }).sort({ createdAt: -1 });
    res.json(categories);
  } catch (err) {
    next(err);
  }
};

export const getCategoryById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const barbershopId = req.barbershopId;

    const cat = await ServiceCategory.findOne({ _id: id, barbershopId });
    if (!cat) return res.status(404).json({ message: "Category not found" });

    res.json(cat);
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const barbershopId = req.barbershopId;
    const updates = req.body;

    const cat = await ServiceCategory.findOneAndUpdate({ _id: id, barbershopId }, updates, { new: true });
    if (!cat) return res.status(404).json({ message: "Category not found" });

    res.json(cat);
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const barbershopId = req.barbershopId;

    const category = await ServiceCategory.findOne({
      _id: id,
      barbershopId,
      isActive: true
    });

    if (!category)
      return res.status(404).json({ message: "Category not found or already inactive" });

    // Soft delete this category
    category.isActive = false;
    await category.save();

    // Soft delete all associated services
    await Service.updateMany(
      { categoryId: id, barbershopId },
      { isActive: false }
    );

    res.json({
      message: "Category and its services are deactivated successfully.",
      category
    });
  } catch (err) {
    next(err);
  }
};
export const restoreCategory = async (req, res, next) => {
  try {
    const { id } = req.params;
    const barbershopId = req.barbershopId;

    const category = await ServiceCategory.findOne({
      _id: id,
      barbershopId,
    });

    if (!category)
      return res.status(404).json({ message: "Category not found" });

    category.isActive = true;
    await category.save();

    // Restore services that were soft-deleted
    await Service.updateMany(
      { categoryId: id, barbershopId },
      { isActive: true }
    );

    res.json({
      message: "Category and its services restored successfully.",
      category,
    });
  } catch (err) {
    next(err);
  }
};
