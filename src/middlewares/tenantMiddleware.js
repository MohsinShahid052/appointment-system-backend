export const requireTenant = (adminCanSelect = false) => {
  return (req, res, next) => {
    if (!req.user) return res.status(500).json({ message: "Auth middleware missing" });

    if (req.user.role === "barbershop") {
      req.barbershopId = req.user.barbershopId;
      return next();
    }

    if (req.user.role === "admin" && adminCanSelect && req.query.barbershopId) {
      req.barbershopId = req.query.barbershopId;
      return next();
    }

    return res.status(403).json({ message: "Tenant context required" });
  };
};
