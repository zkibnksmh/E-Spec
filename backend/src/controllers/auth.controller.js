const getCurrentUser = (req, res) => {
  res.status(200).json({
    success: true,
    data: req.user,
  });
};

module.exports = {
  getCurrentUser,
};
