        import Employee from "../models/Employee.js";
        import Service from "../models/Service.js";

        /**
         * Create Employee
         * req.barbershopId must be set by tenant middleware
         */
        export const createEmployee = async (req, res, next) => {
        try {
            const barbershopId = req.barbershopId;
            const { name, email, phone, photo, services = [], workingHours = {}, notes,gender } = req.body;

            if (!name) return res.status(400).json({ message: "Employee name is required" });

            // validate service ids belong to this barbershop (optional but recommended)
            if (services.length) {
            const invalid = await Service.findOne({ _id: { $in: services }, barbershopId: { $ne: barbershopId }});
            if (invalid) return res.status(400).json({ message: "One or more services are not valid for this barbershop" });
            }

            const emp = await Employee.create({
            barbershopId,
            name,
            email,
            phone,
            photo,
            services,
            workingHours,
            notes,
            gender,
            });

            res.status(201).json(emp);
        } catch (err) {
            next(err);
        }
        };

     export const getEmployees = async (req, res, next) => {
  try {
    const barbershopId = req.barbershopId;
    const { active = "true" } = req.query;

    const filter = { barbershopId };

    if (active === "true") filter.isActive = true;
    else if (active === "false") filter.isActive = false;

    const employees = await Employee.find(filter).populate({
      path: "services",
      select: "name duration price isActive",
      match: { isActive: true }, // 🔥 only active services
    });

    // Transform the data to include both service objects and service IDs
    const transformedEmployees = employees.map(emp => {
      const employeeObj = emp.toObject();
      
      // Filter out null services (from the populate match) and get valid service IDs
      const validServices = employeeObj.services.filter(service => service !== null);
      employeeObj.services = validServices;
      
      // Keep the original service IDs array for filtering
      employeeObj.serviceIds = validServices.map(service => service._id.toString());
      
      return employeeObj;
    });

    res.json(transformedEmployees);
  } catch (err) {
    next(err);
  }
};

        export const getEmployeeById = async (req, res, next) => {
        try {
            const { id } = req.params;
            const barbershopId = req.barbershopId;

            const emp = await Employee.findOne({ _id: id, barbershopId });
            if (!emp) return res.status(404).json({ message: "Employee not found" });

            res.json(emp);
        } catch (err) {
            next(err);
        }
        };

        export const updateEmployee = async (req, res, next) => {
        try {
            const { id } = req.params;
            const barbershopId = req.barbershopId;
            const updates = req.body;

            // if services updated, validate
            if (updates.services && updates.services.length) {
            const invalid = await Service.findOne({ _id: { $in: updates.services }, barbershopId: { $ne: barbershopId }});
            if (invalid) return res.status(400).json({ message: "One or more services are not valid for this barbershop" });
            }

            const emp = await Employee.findOneAndUpdate({ _id: id, barbershopId }, updates, { new: true });
            if (!emp) return res.status(404).json({ message: "Employee not found" });

            res.json(emp);
        } catch (err) {
            next(err);
        }
        };

        export const deleteEmployee = async (req, res, next) => {
        try {
            const { id } = req.params;
            const barbershopId = req.barbershopId;

            // soft-delete employee
            const emp = await Employee.findOneAndUpdate(
            { _id: id, barbershopId, isActive: true },
            { isActive: false },
            { new: true }
            );

            if (!emp) return res.status(404).json({ message: "Employee not found or already inactive" });

            // Optional: handle appointments reassignment manually (we won't auto reassign)
            res.json({ message: "Employee deactivated", employee: emp });
        } catch (err) {
            next(err);
        }
        };
    // Restore Employee
    export const restoreEmployee = async (req, res, next) => {
    try {
        const { id } = req.params;
        const barbershopId = req.barbershopId;

        // Restore the employee if they were inactive
        const emp = await Employee.findOneAndUpdate(
        { _id: id, barbershopId, isActive: false },
        { isActive: true },
        { new: true }
        );

        if (!emp) return res.status(404).json({ message: "Employee not found or already active" });

        res.json({ message: "Employee restored successfully", employee: emp });
    } catch (err) {
        next(err);
    }
    };
