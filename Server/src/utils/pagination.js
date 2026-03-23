async function paginate(query, options = {}) {
  const page = Math.max(parseInt(options.page, 10) || 1, 1);
  const limit = Math.min(parseInt(options.limit, 10) || 20, 100);
  const sort = options.sort || '-createdAt';
  const skip = (page - 1) * limit;
  const model = query.model;
  const conditions = query.getQuery ? query.getQuery() : query._conditions;
  const total = await model.countDocuments(conditions);
  const data = await query.skip(skip).limit(limit).sort(sort);
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
}

module.exports = paginate;
