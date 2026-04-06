import express from "express";
import bodyParser from "body-parser";
import axios from "axios";
import pg from "pg";
import bcrypt from "bcrypt";
import passport from "passport";
import { Strategy } from "passport-local";
import session from "express-session";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const saltRounds = 15;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set('view engine', 'ejs');
app.set('views', 'views');

app.use(
  session({
    secret: process.env.SES_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 1 week
    },
  }),
);

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.locals.isLogin = req.isAuthenticated ? req.isAuthenticated() : false;
  next();
});

const db = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// all get route

app.get("/", async (req, res) => {
  if (req.isAuthenticated()) {
    const user_id = req.user.id;
    const short_by = req.query.short_by || "Newest";
    const search =req.query.search || "";
    if(req.query.search){
      const all_book = await db.query("SELECT title, author, cover_i, user_id FROM data JOIN note ON data.id = note.data_id WHERE note.user_id = $1 AND title ILIKE $2", [user_id,`%${search}%`]);
      res.render("index.ejs", { all_book: all_book.rows, user: user_id, short_by: short_by, search: search });
    }else{
    if (short_by === "Newest") {
      const all_book = await db.query("SELECT title, author, cover_i, user_id FROM data JOIN note ON data.id = note.data_id WHERE note.user_id = $1 ORDER BY note.data_id DESC", [user_id]);
      res.render("index.ejs", { all_book: all_book.rows, user: user_id, short_by: short_by, search: search });
    } else if (short_by === "Oldest") {
      const all_book = await db.query("SELECT title, author, cover_i, user_id FROM data JOIN note ON data.id = note.data_id WHERE note.user_id = $1 ORDER BY note.data_id ASC", [user_id]);
      res.render("index.ejs", { all_book: all_book.rows, user: user_id, short_by: short_by, search: search});
    } else if (short_by === "A-Z") {
      const all_book = await db.query("SELECT title, author, cover_i, user_id FROM data JOIN note ON data.id = note.data_id WHERE note.user_id = $1 ORDER BY title ASC", [user_id]);
      res.render("index.ejs", { all_book: all_book.rows, user: user_id, short_by: short_by, search: search });
    }
  }
  } else {
    res.redirect("/login");
  }
});
app.get("/add", async (req, res) => {
  if (req.isAuthenticated()) {
    res.render("add.ejs");
  } else {
    res.redirect("/login");
  }
});
app.get("/note/:user/:id", async (req, res) => {
  if (req.isAuthenticated()) {
    const user_id = req.user.id;
    const cover_i = req.params.id
    // const your_note = await db.query("SELECT title, author, description, cover_i, publish_year, note FROM data JOIN note ON data.id = note.data_id WHERE data.cover_i = $1;", [req.params.id]);
    const your_note = await db.query("SELECT title, author, description, cover_i, publish_year, note, data_id FROM data JOIN note ON data.id = note.data_id WHERE user_id = $1 AND data.cover_i = $2;", [user_id,cover_i]);
    res.render("notes.ejs", { notes: your_note.rows[0] });
  } else {
    res.redirect("/login");
  }
});

app.get("/delete/:id", async (req, res) => {
  if (req.isAuthenticated()) {
    const cover_i = req.params.id;
    const user_id = req.user.id;
    const rows_id = await db.query("SELECT id FROM data WHERE cover_i = $1;", [cover_i]);
    const id = rows_id.rows[0].id;
    await db.query("DELETE FROM note WHERE data_id = $1 AND user_id = $2", [id, user_id]);
    // await db.query("DELETE FROM data WHERE id = $1", [id]);
    res.redirect("/");
  } else {
    res.redirect("/login");
  }
});
app.get("/edit/:id", async (req, res) => {
  if (req.isAuthenticated()) {
    const cover_i = req.params.id;
    const rows_id = await db.query("SELECT title, author, cover_i, publish_year, note, data_id FROM data JOIN note ON data.id = note.data_id WHERE data.cover_i = $1 and user_id = $2;", [cover_i, req.user.id]);
    const data = rows_id.rows[0];
    res.render("edit.ejs", { data: data });
  } else {
    res.redirect("/login");
  }
});

app.get("/enter_note/:key", async (req, res) => {
  if (req.isAuthenticated()) {
    const key = req.params.key;
    const result = await db.query("SELECT * FROM data WHERE key=$1", [req.params.key]);
    const book = result.rows[0];
    res.render(`enter_note.ejs`, { book: book, key: key });
  } else {
    res.redirect("/login");
  }
});
app.get("/login", (req, res) => {
  if (req.query.login === "fail") {
    res.render("login.ejs", { err: "Invalid email or password" });
  } else {
    res.render("login.ejs");
  }
});
app.get("/register", (req, res) => {
  res.render("register.ejs");
});
app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/login");
    }
  });
});
// all post route

app.post("/add_data", async (req, res) => {
  if (req.isAuthenticated()) {
    let book = req.body.book_name;
    let author = req.body.author_name;
    try {
      const response_data = await axios.get(`https://openlibrary.org/search.json?q=${encodeURIComponent(book)}&author=${encodeURIComponent(author)}`);
      if(response_data.data.docs.length === 0){
        res.send("BOOK not found");
      }else{
      const key = response_data.data.docs[0].key;
      const title = response_data.data.docs[0].title;
      const author_name = response_data.data.docs[0].author_name;
      const cover_i = response_data.data.docs[0].cover_i;
      const publsh_year = response_data.data.docs[0].first_publish_year;
      const response_description = await axios.get(`https://openlibrary.org/${key}.json`);
      const description = response_description.data.description.value;

      const key_check = await db.query("SELECT * FROM data WHERE key = $1", [key]);
      const notes_check = await db.query("SELECT data_id, user_id from note JOIN data on note.data_id = data.id WHERE data.cover_i = $1 AND user_id = $2",[cover_i, req.user.id]);
      if (key_check.rows.length === 0) {
        await db.query("INSERT INTO data VALUES (DEFAULT,$1,$2,$3,$4,$5,$6)", [key, title, author_name, description, cover_i, publsh_year]);
        res.redirect(`/enter_note/${encodeURIComponent(key)}`);
      }else if(notes_check.rows.length !== 0){
         res.redirect(`/note/${req.user.id}/${cover_i}`);
      }else{
          res.redirect(`/enter_note/${encodeURIComponent(key)}`);
      }
    }
    } catch (error) {
      if (error.response) {
        console.error(error.response);
        res.send("error");
      } else {
        console.error(error.message);
        res.send("error2");
      }
    }
  } else {
    res.redirect("/login");
  }
});

app.post("/submit_note", async (req, res) => {
  if (req.isAuthenticated()) {
    const user_id = req.user.id;
    const result = await db.query("SELECT * FROM data WHERE key=$1", [req.body.key]);
    const note_id = result.rows[0].id;
    const note = req.body.note;
    await db.query("INSERT INTO note VALUES (DEFAULT,$1,$2,$3)", [note, note_id, user_id]);
    res.redirect("/");
  } else {
    res.redirect("/login");
  }
});
app.post("/submit_edit_note", async (req, res) => {
  if(req.isAuthenticated()){
  await db.query("UPDATE note SET note=$1 WHERE data_id=$2 AND user_id = $3;", [req.body.note, req.body.id, req.user.id]);
  res.redirect(`/note/${req.user.id}/${req.body.cover_i}`);
  }else{
    res.redirect("/login");
  }
});

app.post("/register", async (req, res) => {
  const email = req.body.email;
  const password = req.body.password;
  const confirm_password = req.body.confirm_password;
  try {
    const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
    if (result.rows.length > 0) {
      return res.render("register.ejs", { err: "Email already registered" });
    } else if (password === confirm_password) {
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.log(err);
        } else {
          try {
            const insertResult = await db.query("INSERT INTO users (email,password) VALUES ($1,$2) RETURNING *", [email, hash]);
            const user = insertResult.rows[0];
            req.login(user, (err) => {
              if (err) {
                console.log(err);
              } else {
                res.redirect("/");
              }
            });
          } catch (err) {
            console.log(err);
          }
        }
      });
    } else {
      res.render("register.ejs", { err: "Passwords do not match" });
    }
  } catch (err) {
    console.log(err);
  }
});

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/login?login=fail",
  }),
);
// Define strategy

passport.use(
  "local",
  new Strategy({ usernameField: "email" }, async function verify(email, password, cb) {
    try {
      const result = await db.query("SELECT * FROM users WHERE email = $1", [email]);
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        bcrypt.compare(password, storedHashedPassword, (err, valid) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cb(err);
          } else {
            if (valid) {
              return cb(null, user);
            } else {
              return cb(null, false);
            }
          }
        });
      } else {
        return cb(null, false);
      }
    } catch (err) {
      console.log(err);
    }
  }),
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

app.use((req, res) => {
  res.status(404).send("Page not found");
});
app.listen(port, () => {
  console.log(`Listening on port ${port}`);
});
