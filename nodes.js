"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.PageNode = exports.ShopDetailsNode = exports.ShopPolicyNode = exports.ProductVariantMetafieldNode = exports.ProductVariantNode = exports.ProductOptionNode = exports.ProductMetafieldNode = exports.ProductNode = exports.CommentNode = exports.CollectionNode = exports.BlogNode = exports.ArticleNode = void 0;

var _gatsbyNodeHelpers = _interopRequireDefault(require("gatsby-node-helpers"));

var _pIteration = require("p-iteration");

var _gatsbySourceFilesystem = require("gatsby-source-filesystem");

var _constants = require("./constants");

const {
  createNodeFactory,
  generateNodeId
} = (0, _gatsbyNodeHelpers.default)({
  typePrefix: _constants.TYPE_PREFIX
});

const downloadImageAndCreateFileNode = async ({
  url,
  nodeId
}, {
  createNode,
  createNodeId,
  touchNode,
  store,
  cache,
  getCache,
  reporter
}) => {
  let fileNodeID;
  const mediaDataCacheKey = `${_constants.TYPE_PREFIX}__Media__${url}`;
  const cacheMediaData = await cache.get(mediaDataCacheKey);

  if (cacheMediaData) {
    fileNodeID = cacheMediaData.fileNodeID;
    touchNode({
      nodeId: fileNodeID
    });
    return fileNodeID;
  }

  const fileNode = await (0, _gatsbySourceFilesystem.createRemoteFileNode)({
    url,
    store,
    cache,
    createNode,
    createNodeId,
    getCache,
    parentNodeId: nodeId,
    reporter
  });

  if (fileNode) {
    fileNodeID = fileNode.id;
    await cache.set(mediaDataCacheKey, {
      fileNodeID
    });
    return fileNodeID;
  }

  return undefined;
};

const ArticleNode = imageArgs => createNodeFactory(_constants.ARTICLE, async node => {
  if (node.blog) node.blog___NODE = generateNodeId(_constants.BLOG, node.blog.id);
  if (node.comments) node.comments___NODE = node.comments.edges.map(edge => generateNodeId(_constants.COMMENT, edge.node.id));
  if (node.image) node.image.localFile___NODE = process.env.NODE_ENV !== "development" ? await downloadImageAndCreateFileNode({
    id: node.image.id,
    url: node.image.src,
    nodeId: node.id
  }, imageArgs) : undefined;
  return node;
});

exports.ArticleNode = ArticleNode;

const BlogNode = _imageArgs => createNodeFactory(_constants.BLOG);

exports.BlogNode = BlogNode;

const CollectionNode = imageArgs => createNodeFactory(_constants.COLLECTION, async node => {
  if (node.products) {
    node.products___NODE = node.products.edges.map(edge => generateNodeId(_constants.PRODUCT, edge.node.id));
    delete node.products;
  }

  if (node.image) node.image.localFile___NODE = process.env.NODE_ENV !== "development" ? await downloadImageAndCreateFileNode({
    id: node.image.id,
    url: node.image.src && node.image.src.split(`?`)[0],
    nodeId: node.id
  }, imageArgs) : undefined;
  return node;
});

exports.CollectionNode = CollectionNode;

const CommentNode = _imageArgs => createNodeFactory(_constants.COMMENT);

exports.CommentNode = CommentNode;

const ProductNode = (imageArgs, reviews) => createNodeFactory(_constants.PRODUCT, async node => {
  if (node.variants) {
    const variants = node.variants.edges.map(edge => edge.node);
    node.variants___NODE = variants.map(variant => generateNodeId(_constants.PRODUCT_VARIANT, variant.id));
    delete node.variants;
  }

  if (node.metafields) {
    const metafields = node.metafields.edges.map(edge => edge.node);
    node.metafields___NODE = metafields.map(metafield => generateNodeId(_constants.PRODUCT_METAFIELD, metafield.id));
    delete node.metafields;
  }

  if (node.options) {
    node.options___NODE = node.options.map(option => generateNodeId(_constants.PRODUCT_OPTION, option.id));
    delete node.options;
  }

  if (node.images && node.images.edges) node.images = await (0, _pIteration.map)(node.images.edges, async edge => {
    edge.node.localFile___NODE = process.env.NODE_ENV !== "development" ? await downloadImageAndCreateFileNode({
      id: edge.node.id,
      url: edge.node.originalSrc && edge.node.originalSrc.split(`?`)[0]
    }, imageArgs) : undefined;
    return edge.node;
  });

  if (reviews) {
    node.reviews = reviews.reviews;
    node.averageRating = reviews.averageRating;
  }

  return node;
});

exports.ProductNode = ProductNode;

const ProductMetafieldNode = _imageArgs => createNodeFactory(_constants.PRODUCT_METAFIELD);

exports.ProductMetafieldNode = ProductMetafieldNode;

const ProductOptionNode = _imageArgs => createNodeFactory(_constants.PRODUCT_OPTION);

exports.ProductOptionNode = ProductOptionNode;

const ProductVariantNode = (imageArgs, productNode) => createNodeFactory(_constants.PRODUCT_VARIANT, async node => {
  if (node.metafields) {
    const metafields = node.metafields.edges.map(edge => edge.node);
    node.metafields___NODE = metafields.map(metafield => generateNodeId(_constants.PRODUCT_VARIANT_METAFIELD, metafield.id));
    delete node.metafields;
  }

  if (node.image) node.image.localFile___NODE = process.env.NODE_ENV !== "development" ? await downloadImageAndCreateFileNode({
    id: node.image.id,
    url: node.image.originalSrc && node.image.originalSrc.split(`?`)[0]
  }, imageArgs) : undefined;
  node.product___NODE = productNode.id;
  return node;
});

exports.ProductVariantNode = ProductVariantNode;

const ProductVariantMetafieldNode = _imageArgs => createNodeFactory(_constants.PRODUCT_VARIANT_METAFIELD);

exports.ProductVariantMetafieldNode = ProductVariantMetafieldNode;
const ShopPolicyNode = createNodeFactory(_constants.SHOP_POLICY);
exports.ShopPolicyNode = ShopPolicyNode;
const ShopDetailsNode = createNodeFactory(_constants.SHOP_DETAILS);
exports.ShopDetailsNode = ShopDetailsNode;
const PageNode = createNodeFactory(_constants.PAGE);
exports.PageNode = PageNode;