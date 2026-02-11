import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import dotenv from "dotenv";
dotenv.config();
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT
});
const port = 3000;
const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
db.connect();
app.get("/", async (req, res) => {
  const all_book = await db.query("SELECT title, author, cover_i FROM data")
    res.render("index.ejs",{all_book:all_book.rows});
});
app.get("/add", async (req, res) => {
  res.render("add.ejs");
});
app.post("/add_data", async (req, res) => {
  let book = req.body.book_name;
  let author = req.body.author_name;
  try {
    const response_data = await axios.get(`https://openlibrary.org/search.json?q=${encodeURIComponent(book)}&author=${encodeURIComponent(author)}`);
    const key = response_data.data.docs[0].key;
    const title = response_data.data.docs[0].title;
    const author_name = response_data.data.docs[0].author_name;
    const cover_i = response_data.data.docs[0].cover_i;
    const publsh_year = response_data.data.docs[0].first_publish_year;
    const response_description = await axios.get(`https://openlibrary.org/${key}.json`);
    const description = response_description.data.description.value;
    await db.query("INSERT INTO data VALUES (DEFAULT,$1,$2,$3,$4,$5,$6)", [key, title, author_name, description, cover_i, publsh_year]);
    res.redirect(`/enter_note/${encodeURIComponent(key)}`);
  } catch (error) {
    if (error.response) {
      console.error(error.response);
    } else {
      console.error(error.message);
    }
  }
});
app.get("/enter_note/:key", async (req, res) => {
  const key = req.params.key
  const result = await db.query("SELECT * FROM data WHERE key=$1", [req.params.key]);
  const book = result.rows[0];
  res.render(`enter_note.ejs`, { book:book,key:key });
});
app.post("/submit_note",async (req,res)=>{
  const result = await db.query("SELECT * FROM data WHERE key=$1", [req.body.key]);
  const note_id = result.rows[0].id;
  const note = req.body.note;
  await db.query("INSERT INTO note VALUES (DEFAULT,$1,$2)",[note,note_id]);
  res.redirect("/");
});
app.get("/note/:id",async (req,res)=>{
 const your_note=await db.query("SELECT title, author, description, cover_i, publish_year, note FROM data JOIN note ON data.id = note.data_id WHERE data.cover_i = $1;",[req.params.id]);
  res.render("notes.ejs",{notes:your_note.rows[0]});
});
app.get("/delete/:id",async(req,res)=>{
  const cover_i = req.params.id;
  const rows_id = await db.query("SELECT id FROM data WHERE cover_i = $1;",[cover_i]);
  const id = rows_id.rows[0].id;
  await db.query("DELETE FROM note WHERE data_id = $1",[id]);
  await db.query("DELETE FROM data WHERE id = $1",[id]);
  res.redirect("/");
});
app.get("/edit/:id",async(req,res)=>{
  const cover_i = req.params.id;
  const rows_id = await db.query("SELECT title, author, cover_i, publish_year, note, data_id FROM data JOIN note ON data.id = note.data_id WHERE data.cover_i = $1;",[cover_i]);
  const data = rows_id.rows[0];
  res.render("edit.ejs",{data : data})
});
app.post("/submit_edit_note",async(req,res)=>{
  await db.query("UPDATE note SET note=$1 WHERE data_id=$2;",[req.body.note, req.body.id]);
  res.redirect(`/note/${req.body.cover_i}`);
});
app.use((req,res)=>{
  res.status(404).send("page not found");
});
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
