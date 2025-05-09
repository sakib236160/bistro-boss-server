// index.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.k7k1l.mongodb.net/?appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();



    const menuCollection = client.db("bistroDb").collection("menu");
    const userCollection = client.db("bistroDb").collection("users");
    const reviewCollection = client.db("bistroDb").collection("reviews");
    const cartCollection = client.db("bistroDb").collection("carts");
    const paymentCollection = client.db("bistroDb").collection("payments");


    // jwt related api
    app.post('/jwt', async(req,res)=>{
      const user =req.body;
      const token = jwt.sign(user,process.env.ACCESS_TOKEN_SECRET,{
        expiresIn:'1h'
      })
      res.send({token});
    })

    // midleware varyfay tokan
    const verifyToken = (req,res, next) =>{
      // console.log('inside varify token',req.headers.authorization);
      if(!req.headers.authorization){
        return res.status(401).send({message: 'unauthorized access'});
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err,decoded)=>{
        if(err){
          return res.status(401).send({message: 'unauthorized access'})
        }
        req.decoded = decoded;
        next();
      })
    }
// user varify admin after varifytoken
    const varifyAdmin = async(req,res,next)=>{
      const email = req.decoded.email;
      const query = {email: email};
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === 'admin';
      if(!isAdmin){
        return res.status(403).send({message: 'forbidden access'})
      }
      next();
    }

    // user related api
    app.get("/users", verifyToken, varifyAdmin, async (req,res)=>{
      
      const result = await userCollection.find().toArray();
      res.send(result);
    })

    app.get('/users/admin/:email', verifyToken, async(req,res)=>{
      const email = req.params.email;
      if(email !== req.decoded.email){
        return res.status(403).send({message: 'forbidden access'})
      }
      const query = {email: email};
      const user = await userCollection.findOne(query);
      let admin = false;
      if(user){
        admin = user?.role === 'admin';
      }
      res.send({admin});
    })
    
    app.post("/users", async (req,res)=>{
      const user = req.body;
      const query = {email: user.email}
      const existingUser = await userCollection.findOne(query)
      if(existingUser){
        return res.send({message:"User Alrady exists!", insertedId: null})
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    })

    app.patch("/users/admin/:id", verifyToken, varifyAdmin, async(req,res)=>{
       const id = req.params.id; 
       const filter = {_id: new ObjectId(id)};
       const updatedDoc = {
        $set: {
          role: "admin"
        }
       }
       const result = await userCollection.updateOne(filter, updatedDoc);
       res.send(result);
    })

    app.delete("/users/:id",verifyToken, varifyAdmin, async(req,res)=>{
       const id = req.params.id; 
       const query = {_id: new ObjectId(id)}
       const result = await userCollection.deleteOne(query);
       res.send(result);
    })

    // menu related api
    app.get('/menu', async (req,res)=>{
        const result = await menuCollection.find().toArray();
        res.send(result);
    })

    app.get('/menu/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await menuCollection.findOne(query);
      res.send(result);
    })

    app.post('/menu', verifyToken, varifyAdmin,async(req,res)=>{
      const item =req.body;
      const result= await menuCollection.insertOne(item);
      res.send(result);
    })

    app.patch('/menu/:id', async(req,res)=>{
      const item = req.body;
      const id =req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updatedDoc={
        $set:{
          name: item.name,
          category: item.category,
          price: item.price,
          recipe: item.recipe,
          image: item.image
        }
      }

      const result = await menuCollection.updateOne(filter,updatedDoc);
      res.send(result);
    })

    app.delete('/menu/:id', verifyToken, varifyAdmin,async(req,res)=>{
      const id = req.params.id;
      const query ={_id: new ObjectId(id)}
      const result = await menuCollection.deleteOne(query);
      res.send(result);
    })

    app.get('/reviews', async (req,res)=>{
        const result = await reviewCollection.find().toArray();
        res.send(result);
    })

    // cart collection data
    app.get('/carts', async (req,res)=>{
      const email = req.query.email;
      const query = {email:email};
      const result = await cartCollection.find(query).toArray();
      res.send(result);
  })
    app.post('/carts', async (req,res)=>{
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    })
    app.delete('/carts/:id', async(req,res)=>{
      const id = req.params.id;
      const query = {_id: new ObjectId(id)}
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    })

    // Payment Intern
    app.post('/create-payment-intent', async(req,res)=>{
      const { price } = req.body;
      const amount = parseInt(price * 100);

      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"], 
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    })

    app.get('/payments/:email', verifyToken, async(req,res)=>{
      const query ={email: req.params.email}
      if(req.params.email !== req.decoded.email){
        return res.status(403).send({message:'forbidden access'})
      }
      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    })

    app.post('/payments',async(req,res)=>{
      const payment = req.body;
      const paymentResult = await paymentCollection.insertOne(payment);
      console.log('payment info',payment);
      const query = {
        _id:{
          $in: payment.cartIds.map(id=>new ObjectId(id))
        }
      };
      const deleteResult = await cartCollection.deleteMany(query);
      res.send({paymentResult,deleteResult});
    })

    // stats or analytic
    app.get('/admin-stats', async(req,res)=>{
      // verifyToken, varifyAdmin,
      const users = await userCollection.estimatedDocumentCount();
      const menuItem = await menuCollection.estimatedDocumentCount();
      const orders = await paymentCollection.estimatedDocumentCount();
      // This is Not Best Way
      // const payments = await paymentCollection.find().toArray();
      // const revenue = payments.reduce((total,payment)=>total + payment.price,0);

      const result = await paymentCollection.aggregate([
        {
          $group:{
            _id:null,
            totalRevenue:{
              $sum: '$price'
            }
          }
        }
      ]).toArray();

      const revenue =result.length > 0 ? result[0].totalRevenue : 0;


      res.send({
        users, menuItem, orders,revenue
      })
    })

    // Order Status 
    app.get('/order-stats',verifyToken, varifyAdmin, async (req,res)=>{
      const result = await paymentCollection.aggregate([
        {
          $unwind: '$menuItemIds'
        },

        {
          $lookup:{
            from: 'menu',
            localField: 'menuItemIds',
            foreignField: '_id',
            as: 'menuItems'
          }
        },

        {
          $unwind: '$menuItems'
        },

        {
          $group:{
            _id: '$menuItems.category',
            quantity:{$sum: 1},
            revenue:{$sum:'$menuItems.price'}
          }
        },

        {
          $project: {
            _id: 0,
            category: '$_id',
            quantity: '$quantity',
            revenue: '$revenue'
          }
        }
      ]).toArray();
      res.send(result);
    })

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);



// Example route
app.get('/', (req, res) => {
  res.send('Server is running!');
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});


/**
 * ----------------------------------------------
 *           NAMING CONVASION
 * ----------------------------------------------
 * app.get("/users")
 * app.get("/usere/:id")
 * app.post("/users")
 * app.put("/users/:id")
 * app.patch("/users/:id")
 * app.delete("users/:id")
 */


