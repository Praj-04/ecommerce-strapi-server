"use strict";

/**
 * order controller
 */

const { createCoreController } = require("@strapi/strapi").factories;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = createCoreController("api::order.order", ({ strapi }) => ({
  async customOrderController(ctx) {
    try {
      const bodyData = ctx.body;

      const entries = await strapi.entityService.findMany(
        "api::product.product",
        {
          fields: ["title"],
          limit:2
        }
      );
      return { data: entries };
    } catch (err) {
      ctx.body = err;
    }
  },

  async create(ctx) {
    try {
      //   we get the data order details from front end through ctx
      const { products } = ctx.request.body;

      //checking order details from front end with strapi and sending to stripe to create a sessionID.
      // This created sessionID will be stored in strapi for that order and also the sessionID will be sent to frontend..
      // in front end use this sessionID to direct to stripe checkout page
      const lineItems =await Promise.all (products.map(async(product) => {

        //we want to take the price informtion from strapi db, we cant believe the price that comes from front end
        const produtEntities = await strapi.entityService.findMany("api::product.product",{
          filters:{
            key: product.key
          }
              })

              const realProduct = produtEntities[0];
        return {
          price_data: {
            currency: "inr",
            product_data: {
              name: product.title,
              images:[product.image]
            },
            unit_amount: realProduct.price * 100,
          },
          quantity: product.quantity,
        };
      }));

      //sending request from strapi to stripe to create session(in this session we send shipping,lineitems,paymentmode,success/failureurl details)
    //  A sessionID generated  for that session
      const session = await stripe.checkout.sessions.create({
        shipping_address_collection: {
          allowed_countries: ['IN'],
        },
        line_items: lineItems,
        mode: "payment",
        success_url: `${process.env.CLIENT_BASE_URL}/payments/success`,
        cancel_url: `${process.env.CLIENT_BASE_URL}/payments/failed`,
      });

      //sessionID and product stored in strapi for the order
      await strapi.entityService.create("api::order.order", {
        data: {
          products,
          stripeId: session.id,
        },
      });
      return { stripeId: session.id };
    } catch (error) {
      console.log('Error here ',error);
      ctx.response.status = 500;
      return error;
    }
  },
}));
