"use strict";

var _interopRequireDefault = require("@babel/runtime/helpers/interopRequireDefault");

exports.__esModule = true;
exports.sourceNodes = void 0;

var _fp = require("lodash/fp");

var _chalk = _interopRequireDefault(require("chalk"));

var _pIteration = require("p-iteration");

var _axios = _interopRequireDefault(require("axios"));

var _lib = require("./lib");

var _createClient = require("./create-client");

var _nodes = require("./nodes");

var _constants = require("./constants");

var _queries = require("./queries");

const sourceNodes = async ({
  actions: {
    createNode,
    touchNode
  },
  createNodeId,
  store,
  cache,
  getCache,
  reporter
}, {
  shopName,
  accessToken,
  apiVersion = `2020-07`,
  verbose = true,
  paginationSize = 250,
  includeCollections = [_constants.SHOP, _constants.CONTENT],
  shopifyQueries = {}
}) => {
  const client = (0, _createClient.createClient)(shopName, accessToken, apiVersion);

  const fs = require("fs");

  const v8 = require("v8");

  const defaultQueries = {
    articles: _queries.ARTICLES_QUERY,
    blogs: _queries.BLOGS_QUERY,
    collections: _queries.COLLECTIONS_QUERY,
    products: _queries.PRODUCTS_QUERY,
    shopPolicies: _queries.SHOP_POLICIES_QUERY,
    shopDetails: _queries.SHOP_DETAILS_QUERY,
    pages: _queries.PAGES_QUERY
  };
  const queries = { ...defaultQueries,
    ...shopifyQueries
  }; // Convenience function to namespace console messages.

  const formatMsg = msg => (0, _chalk.default)`\n{blue gatsby-source-shopify/${shopName}} ${msg}`;

  try {
    console.log(formatMsg(`starting to fetch data from Shopify`)); // Arguments used for file node creation.

    const imageArgs = {
      createNode,
      createNodeId,
      touchNode,
      store,
      cache,
      getCache,
      reporter
    }; // Arguments used for node creation.

    const args = {
      client,
      createNode,
      createNodeId,
      formatMsg,
      verbose,
      imageArgs,
      paginationSize,
      queries
    }; // Message printed when fetching is complete.

    const msg = formatMsg(`finished fetching data from Shopify`);

    const getReviews = () => {
      const reviewFileLocation = `./config/${process.env.SHOPIFY_STORE_NAME}/reviews-cache.txt`; // Read from local cache if exists

      if (fs.existsSync(reviewFileLocation)) {
        return v8.deserialize(fs.readFileSync(reviewFileLocation));
      } // Recursively fetch reviews and write in an array


      const productReviews = [];

      const fetchReviewsRecursively = async (page = 1) => {
        const response = await _axios.default.get(`https://judge.me//api/v1/reviews`, {
          data: {
            api_token: process.env.REVIEWS_API_TOKEN,
            shop_domain: process.env.REVIEWS_SHOP_DOMAIN,
            page
          }
        });
        const {
          data
        } = response;

        if (data.reviews.length > 0) {
          data.reviews.forEach(result => {
            // Skip hidden reviews
            if (result.hidden || result.curated !== "ok") {
              return;
            }

            let productAlreadyExists = false;

            for (const product of productReviews) {
              if (product.handle === result.product_handle) {
                product.reviews.push(result);
                productAlreadyExists = true;
                break;
              }
            }

            if (!productAlreadyExists) {
              productReviews.push({
                handle: result.product_handle,
                reviews: [result]
              });
            }
          });
          return fetchReviewsRecursively(page + 1);
        } // Calculate average rating for each product


        productReviews.forEach(product => {
          const ratingsSum = product.reviews.reduce((accumulator, review) => accumulator + review.rating, 0);
          product.averageRating = Math.round(ratingsSum / product.reviews.length * 2) / 2;
        }); // Create cache file in a development mode

        if (process.env.NODE_ENV === "development") {
          fs.writeFileSync(reviewFileLocation, v8.serialize(productReviews));
        }

        return productReviews;
      };

      return fetchReviewsRecursively();
    };

    let promises = [];

    if (includeCollections.includes(_constants.SHOP)) {
      let allReviews;

      try {
        allReviews = await getReviews();
      } catch (e) {
        console.log(e);
      }

      promises = promises.concat([createNodes(_constants.COLLECTION, queries.collections, _nodes.CollectionNode, args), createNodes(_constants.PRODUCT, queries.products, _nodes.ProductNode, args, allReviews, async (product, productNode) => {
        if (product.variants) await (0, _pIteration.forEach)(product.variants.edges, async edge => {
          const v = edge.node;
          if (v.metafields) await (0, _pIteration.forEach)(v.metafields.edges, async (edge) => createNode(await (0, _nodes.ProductVariantMetafieldNode)(imageArgs)(edge.node)));
          return createNode(await (0, _nodes.ProductVariantNode)(imageArgs, productNode)(edge.node));
        });
        if (product.metafields) await (0, _pIteration.forEach)(product.metafields.edges, async (edge) => createNode(await (0, _nodes.ProductMetafieldNode)(imageArgs)(edge.node)));
        if (product.options) await (0, _pIteration.forEach)(product.options, async (option) => createNode(await (0, _nodes.ProductOptionNode)(imageArgs)(option)));
      }) // createShopPolicies(args),
      // createShopDetails(args)
      ]);
    }

    if (includeCollections.includes(_constants.CONTENT)) {
      promises = promises.concat([createNodes(_constants.BLOG, queries.blogs, _nodes.BlogNode, args), createNodes(_constants.ARTICLE, queries.articles, _nodes.ArticleNode, args, async x => {
        if (x.comments) await (0, _pIteration.forEach)(x.comments.edges, async (edge) => createNode(await (0, _nodes.CommentNode)(imageArgs)(edge.node)));
      }), createPageNodes(_constants.PAGE, queries.pages, _nodes.PageNode, args)]);
    }

    console.time(msg);
    await Promise.all(promises);
    console.timeEnd(msg);
  } catch (e) {
    console.error((0, _chalk.default)`\n{red error} an error occurred while sourcing data`); // If not a GraphQL request error, let Gatsby print the error.

    if (!e.hasOwnProperty(`request`)) throw e;
    (0, _lib.printGraphQLError)(e);
  }
};
/**
 * Fetch and create nodes for the provided endpoint, query, and node factory.
 */


exports.sourceNodes = sourceNodes;

const createNodes = async (endpoint, query, nodeFactory, {
  client,
  createNode,
  formatMsg,
  verbose,
  imageArgs,
  paginationSize
}, allReviews, f = async () => {}) => {
  // Message printed when fetching is complete.
  const msg = formatMsg(`fetched and processed ${endpoint} nodes`);
  if (verbose) console.time(msg);
  await (0, _pIteration.forEach)(await (0, _lib.queryAll)(client, [_constants.NODE_TO_ENDPOINT_MAPPING[endpoint]], query, paginationSize), async entity => {
    let reviews;

    if (allReviews) {
      reviews = allReviews.find(item => item.handle === entity.handle);
    }

    const node = await nodeFactory(imageArgs, reviews)(entity);
    createNode(node);
    await f(entity, node);
  });
  if (verbose) console.timeEnd(msg);
};
/**
 * Fetch and create nodes for shop policies.
 */


const createShopDetails = async ({
  client,
  createNode,
  formatMsg,
  verbose,
  queries
}) => {
  // // Message printed when fetching is complete.
  const msg = formatMsg(`fetched and processed ${_constants.SHOP_DETAILS} nodes`);
  if (verbose) console.time(msg);
  const {
    shop
  } = await (0, _lib.queryOnce)(client, queries.shopDetails);
  createNode((0, _nodes.ShopDetailsNode)(shop));
  if (verbose) console.timeEnd(msg);
};
/**
 * Fetch and create nodes for shop policies.
 */


const createShopPolicies = async ({
  client,
  createNode,
  formatMsg,
  verbose,
  queries
}) => {
  // Message printed when fetching is complete.
  const msg = formatMsg(`fetched and processed ${_constants.SHOP_POLICY} nodes`);
  if (verbose) console.time(msg);
  const {
    shop: policies
  } = await (0, _lib.queryOnce)(client, queries.shopPolicies);
  Object.entries(policies).filter(([_, policy]) => Boolean(policy)).forEach((0, _fp.pipe)(([type, policy]) => (0, _nodes.ShopPolicyNode)(policy, {
    type
  }), createNode));
  if (verbose) console.timeEnd(msg);
};

const createPageNodes = async (endpoint, query, nodeFactory, {
  client,
  createNode,
  formatMsg,
  verbose,
  paginationSize
}, f = async () => {}) => {
  // Message printed when fetching is complete.
  const msg = formatMsg(`fetched and processed ${endpoint} nodes`);
  if (verbose) console.time(msg);
  await (0, _pIteration.forEach)(await (0, _lib.queryAll)(client, [_constants.NODE_TO_ENDPOINT_MAPPING[endpoint]], query, paginationSize), async entity => {
    const node = await nodeFactory(entity);
    createNode(node);
    await f(entity);
  });
  if (verbose) console.timeEnd(msg);
};