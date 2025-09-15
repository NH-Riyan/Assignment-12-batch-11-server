const express = require('express')
const cors = require('cors')
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

const app = express()
const port = 3000

app.use(cors())
app.use(express.json());



const uri = `mongodb+srv://${process.env.DB_User}:${process.env.DB_Pass}@cluster10.oop5ill.mongodb.net/?retryWrites=true&w=majority&appName=Cluster10`;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

app.get('/', (req, res) => {
  res.send('Hello Word!')
})

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})

async function run() {
  try {
     await client.connect();
     const UserList = client.db("A12B11").collection('users')
    
   
      app.post("/users", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) return res.status(400).send({ message: "Email is required" });

   
        const userExists = await UserList.findOne({ email });
        if (userExists) {
            return res.status(200).send({ message: "User already exists", inserted: false });
        }
        const result = await UserList.insertOne(req.body);
        res.status(201).send({ message: "User created", inserted: true, data: result });
    } catch (err) {
        console.error("Error inserting user:", err);
        res.status(500).send({ message: "Internal Server Error" });
    }
});

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
   
    // await client.close();
  }
}
run().catch(console.dir);
