const express = require('express')
const cors = require('cors')
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
    const PostList = client.db("A12B11").collection('posts')

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

    app.get("/posts/user/:email", async (req, res) => {
      const { email } = req.params;

      const posts = await PostList.find({ authorEmail: email }).toArray();
      res.send(posts);

    });


    app.post("/posts", async (req, res) => {
      const post = req.body;

      try {
        const result = await PostList.insertOne(post);

        await UserList.updateOne(
          { email: post.authorEmail },
          { $inc: { postNumber: 1 } }
        );

        res.status(201).json({ message: "Post created successfully", data: result });
      } catch (err) {
        console.error("Error adding post:", err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });


    // GET /posts/:id
    app.get("/posts/:id", async (req, res) => {
        const postId = req.params.id;
        const post = await PostList.findOne({ _id: new ObjectId(postId) });
        res.send(post); 
      
    });



    app.delete("/posts/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }

        const post = await PostList.findOne(query);

        if (!post) {
          return res.status(404).send({ message: "Post not found" });
        }

        const result = await PostList.deleteOne(query);

        await UserList.updateOne(
          { email: post.authorEmail },
          { $inc: { postNumber: -1 } }
        );

        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });


    app.get("/users/postNumber/:email", async (req, res) => {
      try {
        const email = req.params.email;
        const user = await UserList.findOne({ email }, { projection: { postNumber: 1 } });

        if (!user) {
          return res.status(404).send({ message: "User not found" });
        }

        res.send({ postNumber: user.postNumber || 0 });
      } catch (err) {
        console.error("Error fetching post number:", err);
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
