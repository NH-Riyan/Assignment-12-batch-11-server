const express = require('express')
const cors = require('cors')
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require('stripe')(process.env.PAYMENT_GATEWAY_KEY);
const app = express()
const port = 3000

app.use(cors())
app.use(express.json());

const admin = require("firebase-admin");

const serviceAccount = require("./firebase-adminsdk-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});


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
    const ReportList = client.db("A12B11").collection('reports');
    const AnnouncementsList = client.db("A12B11").collection("Announcements")
    const PaymentList = client.db("A12B11").collection("Payments")

    const verifyFBToken = async (req, res, next) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access f' })
      }
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.decoded = decoded;
        next();
      }
      catch (error) {
        return res.status(403).send({ message: 'forbidden access' })
      }
    }

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email }
      const user = await UserList.findOne(query);
      if (!user || user.role !== 'admin') {
        return res.status(403).send({ message: 'forbidden access' })
      }
      next();
    }

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

    app.get("/users", verifyFBToken, verifyAdmin, async (req, res) => {
      const users = await UserList.find({}).toArray();
      res.send(users);
    });

    app.get("/user/:email", verifyFBToken, async (req, res) => {
      const { email } = req.params;
      const user = await UserList.findOne({ email });
      res.send(user);

    });
    app.get("/users/banwarnings", verifyFBToken, verifyAdmin, async (req, res) => {

      const users = await UserList.find({ warning: { $gte: 5 } }).toArray();
      res.send(users);
    });

    
    app.get('/users/role/:email', verifyFBToken, async (req, res) => {
      try {
        const email = req.params.email;
        const user = await UserList.findOne({ email });

        console.log("d_____________________",user)
        if (!user) {
          return res.status(404).send({ message: 'User not found' });
        }

        res.send({ role: user.role || 'user' });
      } catch (error) {
        console.error("Error finding user by email:", error);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });

    app.patch("/users/changerole/:id", verifyFBToken, verifyAdmin, async (req, res) => {

      const { id } = req.params;
      const user = await UserList.findOne({ _id: new ObjectId(id) });

      const newRole = user.role === "admin" ? "user" : "admin";

      const result = await UserList.updateOne(
        { _id: new ObjectId(id) },
        { $set: { role: newRole } }
      );

      res.send(result);

    });


    app.get("/posts/user/:email", verifyFBToken, async (req, res) => {
      const { email } = req.params;

      const posts = await PostList.find({ authorEmail: email }).toArray();
      res.send(posts);

    });

    app.get("/posts/limit/:email", verifyFBToken, async (req, res) => {
      const { email } = req.params;
      const limit = 3;

      const results = await PostList
        .find({ authorEmail: email })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      res.send(results);
    })

    app.put("/users/incrementWarning/:email", verifyFBToken, verifyAdmin, async (req, res) => {
      const { email } = req.params;

      const result = await UserList.updateOne(
        { email },
        { $inc: { warning: 1 } }
      );

    });


    app.delete("/users/:id", verifyFBToken, verifyAdmin, async (req, res) => {
      const { id } = req.params;
      const user = await UserList.findOne({ _id: new ObjectId(id) });
      const result = await UserList.deleteOne({ _id: new ObjectId(id) });

      const User = await admin.auth().getUserByEmail(user.email);
      await admin.auth().deleteUser(User.uid);

      res.send(result);
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


    app.get("/posts/:id", verifyFBToken, async (req, res) => {
      const postId = req.params.id;
      const post = await PostList.findOne({ _id: new ObjectId(postId) });
      res.send(post);
    });



    app.get("/post/search/:tag", async (req, res) => {
      try {
        const { tag } = req.params;
        if (!tag) {
          return res.status(400).json({ message: "Tag parameter is required" });
        }

        const result = await PostList.find({
          tag: { $regex: new RegExp(tag, "i") }
        }).toArray();

        res.json(result);
      } catch (err) {
        console.error("Error searching posts:", err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });



    app.post("/posts/:id/comment", async (req, res) => {

      const { commenterEmail, commentText, feedback, reported, commentTime } = req.body;
      const postId = req.params.id;

      const user = await UserList.findOne({ email: commenterEmail });
      const commenterName = user.name;

      const newComment = {
        _id: new ObjectId(),
        commenter: commenterName,
        commenterEmail,
        commentText,
        feedback,
        reported,
        commentTime
      };

      await PostList.updateOne(
        { _id: new ObjectId(postId) },
        { $push: { Comment: newComment } }
      );

      res.json({ message: "Comment added", comment: newComment });

    });



    app.post("/posts/:id/upvote", verifyFBToken, async (req, res) => {
      try {
        const { userEmail } = req.body;
        const postId = req.params.id;

        const post = await PostList.findOne({ _id: new ObjectId(postId) });
        post.dislike = post.dislike.filter(email => email !== userEmail);

        if (post.like.includes(userEmail)) {
          post.like = post.like.filter(email => email !== userEmail);
        } else {
          post.like.push(userEmail);
        }

        const upVote = post.like.length;
        const downVote = post.dislike.length;

        await PostList.updateOne(
          { _id: new ObjectId(postId) },
          { $set: { like: post.like, dislike: post.dislike, upVote, downVote } }
        );

        res.json({ like: post.like, dislike: post.dislike, upVote, downVote });
      } catch (err) {
        console.error("Upvote error:", err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });



    app.post("/posts/:id/downvote", verifyFBToken, async (req, res) => {
      try {
        const { userEmail } = req.body;
        const postId = req.params.id;

        const post = await PostList.findOne({ _id: new ObjectId(postId) });
        post.like = post.like.filter(email => email !== userEmail);

        if (post.dislike.includes(userEmail)) {
          post.dislike = post.dislike.filter(email => email !== userEmail);
        } else {
          post.dislike.push(userEmail);
        }

        const upVote = post.like.length;
        const downVote = post.dislike.length;
        await PostList.updateOne(
          { _id: new ObjectId(postId) },
          { $set: { like: post.like, dislike: post.dislike, upVote, downVote } }
        );

        res.json({ like: post.like, dislike: post.dislike, upVote, downVote });
      } catch (err) {
        console.error("Downvote error:", err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    });





    app.get("/posts/recent/:page", async (req, res) => {

      const page = parseInt(req.params.page) || 1;
      const limit = 5;
      const skip = (page - 1) * limit;

      const posts = await PostList.find()
        .sort({ createdAt: -1 }) // newest first
        .skip(skip)
        .limit(limit)
        .toArray();

      const totalPosts = await PostList.countDocuments();
      res.json({ posts, totalPosts });

    });


    app.get("/posts/popular/:page", async (req, res) => {

      const page = parseInt(req.params.page) || 1;
      const limit = parseInt(req.query.limit) || 5;
      const skip = (page - 1) * limit;

      const posts = await PostList.aggregate([
        {
          $addFields: { voteDifference: { $subtract: ["$upVote", "$downVote"] } }
        },
        {
          $sort: { voteDifference: -1, createdAt: -1 }
        },
        { $skip: skip },
        { $limit: limit }
      ]).toArray();

      const totalPosts = await PostList.countDocuments();

      res.json({ posts, totalPosts });

    });


    app.delete("/posts/:id", verifyFBToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }
        const post = await PostList.findOne(query);
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


    app.get("/users/postNumber/:email", verifyFBToken, async (req, res) => {
      try {
        const email = req.params.email;
        const user = await UserList.findOne({ email }, { projection: { postNumber: 1 } });


        res.send({ postNumber: user.postNumber || 0 });
      } catch (err) {
        console.error("Error fetching post number:", err);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });


    app.put("/posts/reportComment/:postId", verifyFBToken, async (req, res) => {

      const { postId } = req.params;
      const { commentId, feedback } = req.body;


      const result = await PostList.updateOne(
        { _id: new ObjectId(postId), "Comment._id": new ObjectId(commentId) },
        {
          $set: {
            "Comment.$.feedback": feedback,
            "Comment.$.reported": true,
          },
        }
      );

      if (result.modifiedCount === 0) {
        return res.status(404).send({ message: "Post or comment not found" });
      }

      res.send({ message: "Comment reported successfully" });

    });


    app.post("/reports", async (req, res) => {
      const reportData = req.body;
      const result = await ReportList.insertOne(reportData);

      res.send(result)

    });

    app.get('/reports', verifyFBToken, verifyAdmin, async (req, res) => {
      const result = await ReportList.find().sort({ reportedAt: -1 }).toArray();
      res.send(result);
    })

    app.put("/reports/solve/:reportId", verifyFBToken, verifyAdmin, async (req, res) => {
      const { reportId } = req.params;

      const result = await ReportList.updateOne(
        { _id: new ObjectId(reportId) },
        { $set: { solved: true } }
      );

      res.send(result)
    });

    app.post("/announcements", verifyFBToken, verifyAdmin, async (req, res) => {
      try {
        const announcementData = req.body;
        const result = await AnnouncementsList.insertOne(announcementData);

        res.send(result);
      } catch (err) {
        console.error(err);
        res.status(500).send({ message: "Internal Server Error" });
      }
    });


    app.get("/announcements", async (req, res) => {
      try {
        const result = await AnnouncementsList.find().toArray();
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Failed to fetch announcements" });
      }
    });

    app.post("/payments", async (req, res) => {
      try {
        const { email, transactionId, paymentMethod } = req.body;

        const paymentDoc = {
          email,
          transactionId,
          paymentMethod,
          status: "succeeded",
          date: new Date(),
        };
        await PaymentList.insertOne(paymentDoc);

        await UserList.updateOne(
          { email },
          { $set: { badge: "gold" } },
          { upsert: true }
        );
        res.json({
          success: true,
          message: "Payment stored & badge updated",
          payment: paymentDoc,
        });
      } catch (error) {
        console.error("Payment API error:", error);
        res.status(500).json({ error: "Server error" });
      }
    });

    app.post('/create-payment-intent', async (req, res) => {
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: 1000,
          currency: 'usd',
          payment_method_types: ['card'],
        });

        res.json({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });



    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {

    // await client.close();
  }
}
run().catch(console.dir);