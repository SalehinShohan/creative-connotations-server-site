const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }

  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_JWT, (err, decoded) => {
    if (err) {
      return res
        .status(403)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};


const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.jxsnyx4.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const classCollection = client.db("CreativeConnotationsDB").collection("classes");
    const instructorsCollection = client.db("CreativeConnotationsDB").collection("instructors");
    const reviewCollection = client.db("CreativeConnotationsDB").collection("reviews");
    const cartCollection = client.db("CreativeConnotationsDB").collection("carts");
    const userCollection = client.db("CreativeConnotationsDB").collection("users");
    const paymentCollection = client.db("CreativeConnotationsDB").collection("payments");

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_JWT, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    app.post("/users",verifyJWT, async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already existing" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    app.get('/users/admin/:email', verifyJWT, verifyAdmin ,async(req, res) => {
      const email = req.params.email;

      if(req.decoded.email !== email){
        res.send({admin: false});
      }

      const query = {email: email};
      const user = await userCollection.findOne(query);
      const result = {admin: user?.role == 'admin'}
      res.send(result);
    })

    app.patch("/users/admin/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get('/users/instructor/:email', verifyJWT, verifyInstructor ,async(req, res) => {
      const email = req.params.email;

      if(req.decoded.email !== email){
        res.send({admin: false});
      }

      const query = {email: email};
      const user = await userCollection.findOne(query);
      const result = {admin: user?.role == 'instructor'}
      res.send(result);
    })

    app.patch("/users/instructor/:id",verifyInstructor, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.get("/class", async (req, res) => {
      const result = await classCollection.find().toArray();
      res.send(result);
    });

    app.post('/class', async(req, res) => {
      const newClass = req.body;
      const result = await classCollection.insertOne(newClass);
      res.send(result);
    })

    
    app.delete("/deleteClass/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.deleteOne(query);
      res.send(result);
    });


    app.put('/updateClass/:id', async(req, res) => {
      const id = req.params.id;
      const body = req.body;
      const filter = {_id: new ObjectId(id)};

      const updatedDoc = {
        $set: {
          price: body.price,
          spotsAvailable: body.spotsAvailable,
          studentsEnrolled: body.studentsEnrolled,
        },
      };

      const result = await classCollection.updateOne(filter, updatedDoc);
      res.send(result)
    })

    app.get("/instructor", async (req, res) => {
      const result = await instructorsCollection.find().toArray();
      res.send(result);
    });

    app.get("/review", async (req, res) => {
      const result = await reviewCollection.find().toArray();
      res.send(result);
    });

    //carts collections
    app.get("/carts", async (req, res) => {
      const email = req.query.email;
      console.log(email);
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req?.decoded?.email;
      if(email !== decodedEmail){
        return res.status(403).send({ error: true, message: "forbidden access" })
      }

      const query = { email: email };
      const result = await cartCollection.find(query).toArray();
      res.send(result);
    });

    app.post("/carts", async (req, res) => {
      const item = req.body;
      const result = await cartCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/carts/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await cartCollection.deleteOne(query);
      res.send(result);
    });

    

    app.patch('/approveClass/:id',verifyJWT, verifyAdmin, async(req,res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateStatus = {
        $set: {status: 'approved'}
      }
      const result = await classCollection.updateOne(filter, updateStatus)
      res.send(result);
    })

    app.patch('/denyClass/:id',verifyJWT,verifyAdmin, async(req,res) => {
      const id = req.params.id;
      const filter = {_id: new ObjectId(id)}
      const updateStatus = {
        $set: {status: 'deny'}
      }
      const result = await classCollection.updateOne(filter, updateStatus)
      res.send(result);
    })


    //payment api

    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
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
    });

    app.post('/payments', async(req, res) => {
      const payment = req.body;

      const instEmail = payment?.instEmail;
      const instQuery = { email: instEmail}
      const instData = await userCollection.findOne(instQuery)
      if(instData?.role === 'instructor') {
        const totalStudent = parseFloat(instData.studentsEnrolled) + 1;
        const updateInst = {
          $set: {studentsEnrolled: totalStudent}
        }
        const updateInstData = await userCollection.updateOne(instQuery, updateInst)
      }

      const addId = payment?.classId;
      const query = {_id: new ObjectId(addId)}
      const dltAddData = await cartCollection.deleteOne(query)
      const prvClassId = payment?.prvclassId
      const prvClassQuery = {_id: new ObjectId(prvClassId)}
      const prvClass = await classCollection.findOne(prvClassQuery)
      const prvSeat = prvClass?.spotsAvailable;
      const prvStudent = prvClass?.studentsEnrolled;

      if(parseFloat(prvSeat) > 0 || parseFloat(prvStudent) >= 0){
        const newSeat = parseFloat(prvSeat) - 1;
        const newStudent = parseFloat(prvStudent) + 1;

        const updateDoc = {
          $set: {
            spotsAvailable: newSeat,
            studentsEnrolled: newStudent
          }
        }
        const updateClassSeats = await classCollection.updateOne(prvClassQuery, updateDoc)
      }







      const result = await paymentCollection.insertOne(payment);
      res.send(result);
    })

    app.get("/payments", async (req, res) => {
      const result = await paymentCollection.find().toArray();
      res.send(result);
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Creative Connotations is running");
});

app.listen(port, () => {
  console.log(`Creative Connotations is run: ${port}`);
});

//CreativeConnotationsDB