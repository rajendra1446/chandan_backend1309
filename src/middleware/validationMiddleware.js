export const validateBody = (rules) => {
  return (req, res, next) => {
    const errors = [];
    const body = req.body || {};

    for (const [field, rule] of Object.entries(rules)) {
      const val = body[field];

      if (rule.required && (val === undefined || val === null || val === "")) {
        errors.push(`'${field}' is required`);
        continue;
      }

      if (val !== undefined && val !== null && val !== "") {
        if (rule.type === "number") {
          const num = Number(val);
          if (isNaN(num)) {
            errors.push(`'${field}' must be a valid number`);
          } else {
            if (rule.min !== undefined && num < rule.min) {
              errors.push(`'${field}' must be at least ${rule.min}`);
            }
            if (rule.max !== undefined && num > rule.max) {
              errors.push(`'${field}' cannot exceed ${rule.max}`);
            }
          }
        } else if (rule.type === "string") {
          if (typeof val !== "string") {
            errors.push(`'${field}' must be a string`);
          } else {
            if (rule.minLength && val.trim().length < rule.minLength) {
              errors.push(`'${field}' must have at least ${rule.minLength} characters`);
            }
            if (rule.enum && !rule.enum.includes(val)) {
              errors.push(`'${field}' must be one of: [${rule.enum.join(", ")}]`);
            }
          }
        } else if (rule.type === "array") {
          if (!Array.isArray(val)) {
            errors.push(`'${field}' must be an array`);
          } else if (rule.minItems && val.length < rule.minItems) {
            errors.push(`'${field}' must contain at least ${rule.minItems} item(s)`);
          }
        } else if (rule.type === "email") {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (typeof val !== "string" || !emailRegex.test(val)) {
            errors.push(`'${field}' must be a valid email address`);
          }
        }
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Validation Error: " + errors.join("; "),
        errors
      });
    }

    next();
  };
};

export const schemas = {
  register: {
    name: { required: true, type: "string", minLength: 2 },
    email: { required: true, type: "email" },
    password: { required: true, type: "string", minLength: 6 },
    role: { type: "string", enum: ["ADMIN", "PLANT_MANAGER", "LAB_CHEMIST", "STORE_MANAGER", "OPERATOR"] }
  },
  login: {
    email: { required: true, type: "email" },
    password: { required: true, type: "string", minLength: 1 }
  },
  updateUser: {
    name: { type: "string", minLength: 2 },
    role: { type: "string", enum: ["ADMIN", "PLANT_MANAGER", "LAB_CHEMIST", "STORE_MANAGER", "OPERATOR"] }
  },
  createHeat: {
    heat_number: { required: true, type: "string", minLength: 2 },
    grade: { required: true, type: "string", minLength: 2 },
    section: { required: true, type: "string", minLength: 2 }
  },
  updateHeat: {
    grade: { type: "string", minLength: 2 },
    section: { type: "string", minLength: 2 }
  },
  addLength: {
    length_meters: { required: true, type: "number", min: 0.1 },
    piece_count: { required: true, type: "number", min: 1 },
    weight_per_piece_kg: { type: "number", min: 0.01 }
  },
  updateLength: {
    length_meters: { type: "number", min: 0.1 },
    piece_count: { type: "number", min: 0 }
  },
  labCheck: {
    verdict: { type: "string", enum: ["PENDING", "APPROVED", "REJECTED", "ON_HOLD", "CONDITIONAL_PASS"] },
    c_percent: { type: "number", min: 0, max: 100 },
    mn_percent: { type: "number", min: 0, max: 100 },
    cr_percent: { type: "number", min: 0, max: 100 },
    ni_percent: { type: "number", min: 0, max: 100 }
  },
  createDispatch: {
    heat_number: { required: true, type: "string", minLength: 2 },
    target_plant: { required: true, type: "string", minLength: 2 },
    dispatched_pieces: { required: true, type: "number", min: 1 },
    dispatched_weight_mt: { required: true, type: "number", min: 0.001 }
  },
  updateDispatch: {
    target_plant: { type: "string" },
    dispatched_pieces: { type: "number", min: 1 },
    dispatched_weight_mt: { type: "number", min: 0.001 }
  },
  createFinishedProduct: {
    heat_number: { required: true, type: "string", minLength: 2 },
    finished_product_name: { required: true, type: "string", minLength: 2 },
    finished_size: { required: true, type: "string", minLength: 1 },
    input_billet_weight_mt: { required: true, type: "number", min: 0.001 },
    finished_weight_mt: { required: true, type: "number", min: 0.001 }
  },
  updateFinishedProduct: {
    finished_product_name: { type: "string" },
    finished_size: { type: "string" },
    finished_weight_mt: { type: "number", min: 0.001 }
  },
  createRejection: {
    heat_number: { required: true, type: "string", minLength: 2 },
    stage: { required: true, type: "string" },
    rejection_type: { required: true, type: "string" },
    rejected_weight_mt: { required: true, type: "number", min: 0.001 },
    rejection_reason: { required: true, type: "string", minLength: 3 }
  },
  updateRejection: {
    stage: { type: "string" },
    rejection_type: { type: "string" },
    rejected_weight_mt: { type: "number", min: 0.001 },
    rejection_reason: { type: "string", minLength: 3 }
  },
  createReturn: {
    heat_number: { required: true, type: "string", minLength: 2 },
    returned_from: { required: true, type: "string" },
    returned_to: { required: true, type: "string" },
    return_type: { required: true, type: "string" },
    returned_pieces: { required: true, type: "number", min: 1 },
    returned_weight_mt: { required: true, type: "number", min: 0.001 },
    return_reason: { required: true, type: "string", minLength: 3 }
  },
  updateReturn: {
    returned_pieces: { type: "number", min: 1 },
    returned_weight_mt: { type: "number", min: 0.001 },
    return_reason: { type: "string", minLength: 3 }
  }
};
