const SuccessHandler = require("../../utils/SuccessHandler");
const ErrorHandler = require("../../utils/ErrorHandler");
const Article = require("../../models/community/article");
const cloud = require("../../functions/cloudinary");
const path = require("path");

const createArticle = async (req, res) => {
  // #swagger.tags = ['article']
  try {
    const { title, description } = req.body;
    const { _id } = req.user;


    let fileUrls = [];

    if (req.files?.files?.length > 0) {
      // Upload all files concurrently
      fileUrls = await Promise.all(
        req.files.files.map(async (file) => {
          const filePath = `${Date.now()}-${path.parse(file.originalname).name}`;
          const uploaded = await cloud.uploadStreamImage(file.buffer, filePath);
          return uploaded.secure_url;
        })
      );
    }

    const newArticle = await Article.create({
      title,
      description,
      user: _id,
      files: fileUrls, 
    });

    return SuccessHandler(newArticle, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const updateArticle = async (req, res) => {
  // #swagger.tags = ['article']
  try {
    const { id } = req.params;
    const {
      title,
      description,
    } = req.body;
    console.log(req.body)

    const existingArticle = await Article.findById(id);

    if (!existingArticle) {
      return ErrorHandler("Article not found", 404, req, res);
    }

     let fileUrls = [];

    if (req.files?.files?.length > 0) {
      // Upload all files concurrently
      fileUrls = await Promise.all(
        req.files.files.map(async (file) => {
          const filePath = `${Date.now()}-${path.parse(file.originalname).name}`;
          const uploaded = await cloud.uploadStreamImage(file.buffer, filePath);
          return uploaded.secure_url;
        })
      );
    }

    existingArticle.title = title ||  existingArticle.title;
    existingArticle.description = description ||  existingArticle.description;
    existingArticle.files = fileUrls ||  existingArticle.fileUrls;
   

    await existingArticle.save();

    return SuccessHandler(existingArticle, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getArticleById = async (req, res) => {
  // #swagger.tags = ['booking']
  try {
    const { id } = req.params;

    const article = await Article.findById(id)

    if (!article) {
      return ErrorHandler("Article not found", 404, req, res);
    }

    return SuccessHandler(article, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const deleteArticle = async (req, res) => {
  // #swagger.tags = ['article']
  try {
    const { id } = req.params;

    const deletedArticle = await Article.findByIdAndDelete(id);

    if (!deletedArticle) {
      return ErrorHandler("Article not found", 404, req, res);
    }

    return SuccessHandler({ message: "Article deleted successfully" }, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const getAllArticles = async (req, res) => {
  // #swagger.tags = ['article']
  try {
    
    const { title, page = 1, limit = 10 } = req.query;
      const matchStage = title
  ? { "title": { $regex: title, $options: "i" } }
  : {};
    const article = await Article.aggregate([
       {
          $match: {
            ...matchStage 
          }
        },
        {
          $lookup: {
            from: "users",
            localField: "user",
            foreignField: "_id",
            as: "userDetails"
          }
        },
        {
          $unwind: "$userDetails"
        },
 {
  $sort:{"createdAt":-1}
 },
  {
    $facet: {
      totalCount: [{ $count: "count" }],
      data: [
        { $skip: (Number(page) - 1) * Number(limit) },
        { $limit: Number(limit) }
      ]
    }
  }
]);

    return SuccessHandler({message:"Article fetched successfully",article}, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, res);
  }
};

const getMyArticles = async (req, res) => {
  // #swagger.tags = ['article']
  try {
    
    const { _id } = req.user;
    const { title, page = 1, limit = 10 } = req.query;
    const matchStage = {
      user: _id, 
      ...(title && { title: { $regex: title, $options: "i" } })
    };
    const article = await Article.aggregate([
       {
          $match: matchStage
        },
 {
  $sort:{"createdAt":-1}
 },
  {
    $facet: {
      totalCount: [{ $count: "count" }],
      data: [
        { $skip: (Number(page) - 1) * Number(limit) },
        { $limit: Number(limit) }
      ]
    }
  }
]);

    return SuccessHandler({message:"Article fetched successfully",article}, 200, res);
  } catch (error) {
    return ErrorHandler(error.message, 500, res);
  }
};

const likeArticle = async (req, res) => {
  // #swagger.tags = ['article']
  try {
    const { id } = req.params;
    const { _id } = req.user;

    const existingArticle = await Article.findById(id);

    if (!existingArticle) {
      return ErrorHandler("Article not found", 404, req, res);
    }

    const alreadyLiked = existingArticle.likes.includes(_id);
    const alreadyDisliked = existingArticle.dislikes.includes(_id);

    // Remove from dislikes if present
    if (alreadyDisliked) {
      existingArticle.dislikes.pull(_id);
    }

    if (alreadyLiked) {
      // Toggle: remove like
      existingArticle.likes.pull(_id);
    } else {
      // Add like
      existingArticle.likes.push(_id);
    }

    await existingArticle.save();

    return SuccessHandler(
      {
        message: alreadyLiked
          ? "Like removed from article"
          : "Article liked successfully",
        article: existingArticle,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};

const dislikeArticle = async (req, res) => {
  // #swagger.tags = ['article']
  try {
    const { id } = req.params;
    const { _id } = req.user;

    const existingArticle = await Article.findById(id);

    if (!existingArticle) {
      return ErrorHandler("Article not found", 404, req, res);
    }

    const alreadyDisliked = existingArticle.dislikes.includes(_id);
    const alreadyLiked = existingArticle.likes.includes(_id);

    // Remove from likes if present
    if (alreadyLiked) {
      existingArticle.likes.pull(_id);
    }

    if (alreadyDisliked) {
      // Toggle: remove dislike
      existingArticle.dislikes.pull(_id);
    } else {
      // Add dislike
      existingArticle.dislikes.push(_id);
    }

    await existingArticle.save();

    return SuccessHandler(
      {
        message: alreadyDisliked
          ? "Dislike removed from article"
          : "Article disliked successfully",
        article: existingArticle,
      },
      200,
      res
    );
  } catch (error) {
    return ErrorHandler(error.message, 500, req, res);
  }
};




module.exports = {
  createArticle,
  updateArticle,
  getArticleById,
  deleteArticle,
  likeArticle,
  dislikeArticle,
  getAllArticles,
  getMyArticles
};