/**
 * Seed Books_and_Dev table from the original Excel data.
 * Writes to LOCAL DynamoDB (http://localhost:8000).
 * Usage: node src/seed-books-local.mjs
 */

import { randomUUID } from "crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const client = DynamoDBDocumentClient.from(
  new DynamoDBClient({ endpoint: "http://localhost:8000", region: "eu-central-1" })
);

const TABLE  = "Books_and_Dev";
const USER   = "local-dev";
const NOW    = new Date().toISOString();

const data = [
  // ── Mihai – Books ──
  { name:"Mihai", source:"Book",  type:"Book",      author:"Neagu Giuvara",                  title:"O scurta istorie a romanilor povestita celor tineri",      dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Haruki Murakami",                title:"La sud de granita, la vest de soare",                      dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Haruki Murakami",                title:"Padurea Norvegiana",                                       dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Isabel Allende",                 title:"Casa spiritelor",                                          dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Hermann Hesse",                  title:"Lupul de stepa",                                           dateCompleted:"2017-12", rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Frank Herbert",                  title:"Dune",                                                     dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Frank Herbert",                  title:"Mantuitorul Dunei",                                        dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Frank Herbert",                  title:"Copiii Dunei",                                             dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Frank Herbert",                  title:"Imparatul zeu al Dunei",                                   dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Frank Herbert",                  title:"Ereticii Dunei",                                           dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Frank Herbert",                  title:"Canonicatul Dunei",                                        dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"James Clavell",                  title:"Shogun",                                                   dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Pascal Bruckner",                title:"Luni de fiere",                                            dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Pascal Bruckner",                title:"Hotii de frumusete",                                       dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Eiji Yoshikawa",                 title:"Musashi",                                                  dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Mircea Eliade",                  title:"Maitreyi",                                                 dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"George Orwell",                  title:"1984",                                                     dateCompleted:"2016-12", rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Paulo Coelho",                   title:"Alchimistul",                                              dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Franz Kafka",                    title:"Procesul",                                                 dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Frederic Beigbeder",             title:"Dragostea dureaza trei ani",                               dateCompleted:"2017-12", rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Sven Hassel",                    title:"Legiunea Blestematilor",                                   dateCompleted:"2017-12", rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Kennedy Toole",                  title:"Conjuratia imbecililor",                                   dateCompleted:"2018-12", rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Herb Cohen",                     title:"Arta de a negocia",                                        dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Rafael Nadal, John Carlin",      title:"Rafa: Povestea mea",                                       dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Andre Agassi",                   title:"Open",                                                     dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Henri Charrière",                title:"Papillon",                                                 dateCompleted:"",        rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Giles Milton",                   title:"Cand Hitler a luat cocaina si Lenin si-a pierdut creierul", dateCompleted:"2019-12", rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Malcolm Gladwell",               title:"Outliers",                                                 dateCompleted:"2020-12", rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Tibi Useriu",                    title:"27 pasi",                                                  dateCompleted:"2021-12", rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Sun Tzu",                        title:"Arta razboiului",                                          dateCompleted:"2021-12", rating:null, comments:"" },
  // ── Mihai – Audiobooks ──
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"John P. Strelecky",              title:"Cafeneaua de la capatul lumii",                            dateCompleted:"2023-12", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"George Orwell",                  title:"Ferma animalelor",                                         dateCompleted:"2023-12", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Alex Michaelides",               title:"Pacienta tacuta",                                          dateCompleted:"2023-12", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Agatha Christie",                title:"Moarte pe NIL",                                            dateCompleted:"2023-12", rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Fyodor Dostoevsky",              title:"Crima si Pedeapsa",                                        dateCompleted:"2023-12", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Louis Gerstner",                 title:"Who says elephants can't dance",                           dateCompleted:"2023-12", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Emily Brontë",                   title:"La rascruce de vanturi",                                   dateCompleted:"2024-12", rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Hans Rosling",                   title:"Factfulness",                                              dateCompleted:"2025-12", rating:null, comments:"" },
  { name:"Mihai", source:"Book",  type:"Book",      author:"Oscar Wilde",                    title:"Portretul lui Dorian Gray",                                dateCompleted:"2025-12", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Holly Jackson",                  title:"Inainte de a muri",                                        dateCompleted:"2025-12", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Ichiro Kishimi, Fumitake Koga",  title:"Curajul de a nu fi pe placul celorlalti",                  dateCompleted:"2025-12", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Catherine Gildiner",             title:"Traume ascunse",                                           dateCompleted:"2025-12", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"David Goggins",                  title:"Nu ma poti rani",                                          dateCompleted:"2025-12", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Jay Shetty",                     title:"Gandeste ca un calugar",                                   dateCompleted:"2026-01", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Gabor Maté",                     title:"Cand corpul spune Nu",                                     dateCompleted:"2026-01", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Mark Manson",                    title:"Arta subtila a nepasarii",                                 dateCompleted:"2026-01", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Ernest Hemingway",               title:"Batranul si marea",                                        dateCompleted:"2026-01", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Brandy Engler, David Rensin",    title:"Barbatii de pe canapeaua mea",                             dateCompleted:"2026-02", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Eddie Jaku",                     title:"Cel mai fericit om de pe Pământ",                          dateCompleted:"2026-02", rating:null, comments:"Foarte buna si emotionanta!!!!" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Mel Robbins",                    title:"Teoria Let Them",                                          dateCompleted:"2026-02", rating:null, comments:"" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Markus Zusak",                   title:"Hoata de carti",                                           dateCompleted:"2026-03", rating:null, comments:"Foarte buna" },
  { name:"Mihai", source:"Voxa",  type:"Audiobook", author:"Seth J. Gillihan",               title:"Terapia cognitiv-comportamentala pe intelesul tuturor",    dateCompleted:"2026-03", rating:null, comments:"Slaba, superficiala" },
  // ── Radu – Books ──
  { name:"Radu",  source:"Book",  type:"Book",      author:"Jacqueline Davies",              title:"Razboiul limonadei",                                       dateCompleted:"2024-12", rating:null, comments:"" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Jeff Kiney",                     title:"Jurnalul unui pusti 1 - Prima carte",                      dateCompleted:"2024-12", rating:null, comments:"" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Jeff Kiney",                     title:"Jurnalul unui pusti 3 - Ultima picatura",                  dateCompleted:"2024-12", rating:null, comments:"" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Jeff Kiney",                     title:"Jurnalul unui pusti 15 - La ananghie",                     dateCompleted:"2024-12", rating:null, comments:"" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Jacqueline Davies",              title:"Procesul limonadei",                                       dateCompleted:"2025-02", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Johanna Spyri",                  title:"Heidi",                                                    dateCompleted:"2025-02", rating:null, comments:"" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Mac Barnett",                    title:"Micul Spion: Sub acoperire",                               dateCompleted:"2025-03", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Roald Dahl",                     title:"Charlie si fabrica de ciocolata",                          dateCompleted:"2025-04", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Barnett / John / Cornell",       title:"Cei doi teribili",                                         dateCompleted:"2025-04", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Roald Dahl",                     title:"Charlie si marele ascensor de sticla",                     dateCompleted:"2025-04", rating:null, comments:"" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Barnett / John / Cornell",       title:"Cei doi teribili 2 - Se intorc",                           dateCompleted:"2025-05", rating:null, comments:"" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Mac Barnett",                    title:"Micul Spion: Jaful imposibil",                             dateCompleted:"2025-05", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Mac Barnett",                    title:"Micul Spion: Un meci strict secret",                       dateCompleted:"2025-05", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Kate Dicamillo",                 title:"Elefantul Magicianului",                                   dateCompleted:"2025-05", rating:null, comments:"" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Barnett / John / Cornell",       title:"Cei doi teribili 3 - In salbaticie",                       dateCompleted:"2025-06", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Jeff Kiney",                     title:"Jurnalul unui pusti 13 - Dezghetul",                       dateCompleted:"2025-06", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Jeff Kiney",                     title:"Jurnalul unui pusti 14 - Marea demolare",                  dateCompleted:"2025-06", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Anh Do",                         title:"Ninja Kid 1",                                              dateCompleted:"2025-07", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Anh Do",                         title:"Ninja Kid 2",                                              dateCompleted:"2025-07", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Anh Do",                         title:"Ninja Kid 3",                                              dateCompleted:"2025-07", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Anh Do",                         title:"Ninja Kid 4",                                              dateCompleted:"2025-08", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Roald Dahl",                     title:"Matilda",                                                  dateCompleted:"2025-08", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Peter Brown",                    title:"Insula robotilor Vol. 1",                                  dateCompleted:"2025-08", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Peter Brown",                    title:"Insula robotilor Vol. 2",                                  dateCompleted:"2025-09", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Roald Dahl",                     title:"James si piersica uriasa",                                 dateCompleted:"2025-09", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"David Walliams",                 title:"Bunicuta hotomana",                                        dateCompleted:"2025-10", rating:null, comments:"Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Dav Pilkey",                     title:"Dog Man",                                                  dateCompleted:"2025-12", rating:null, comments:"English - Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Andy Griffiths & Terry Denton",  title:"The 26-storey treehouse",                                  dateCompleted:"2025-12", rating:null, comments:"English" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Peyo",                           title:"We are the smurfs",                                        dateCompleted:"2025-12", rating:null, comments:"English" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Liconln Peirce",                 title:"Big Nate",                                                 dateCompleted:"2026-01", rating:null, comments:"English - Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Dav Pilkey",                     title:"Dog Man Big Jim Begins",                                   dateCompleted:"2026-01", rating:null, comments:"English - Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Jeff Kiney",                     title:"Diary of a Wimpy Kid",                                     dateCompleted:"2026-02", rating:null, comments:"English - Preferata" },
  { name:"Radu",  source:"Book",  type:"Book",      author:"Dav Pilkey",                     title:"Dog Man Poveste despre pisici",                            dateCompleted:"2026-02", rating:null, comments:"Preferata" },
  // ── Mihai – Trainings ──
  { name:"Mihai", source:"Udemy", type:"Training",  author:"Udemy",                          title:"Executive Briefing: Artificial Intelligence (AI) + ChatGPT", dateCompleted:"2025-12", rating:null, comments:"" },
  { name:"Mihai", source:"Udemy", type:"Training",  author:"Udemy",                          title:"AI Engineer Core Track: LLM Engineering, RAG, QLoRA, Agents", dateCompleted:"2025-12", rating:null, comments:"" },
  { name:"Mihai", source:"Udemy", type:"Training",  author:"Udemy",                          title:"Basic Git and Github - essentials",                         dateCompleted:"2026-01", rating:null, comments:"" },
  { name:"Mihai", source:"Udemy", type:"Training",  author:"Udemy",                          title:"Git with Visual Studio Code",                              dateCompleted:"2026-01", rating:null, comments:"" },
];

let ok = 0, fail = 0;
for (const row of data) {
  const item = { bookId: randomUUID(), userId: USER, createdAt: NOW, updatedAt: NOW, ...row };
  try {
    await client.send(new PutCommand({ TableName: TABLE, Item: item }));
    ok++;
    process.stdout.write(".");
  } catch (e) {
    console.error(`\nFailed: ${row.title} — ${e.message}`);
    fail++;
  }
}
console.log(`\nDone. ${ok} seeded, ${fail} failed.`);
