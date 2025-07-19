const form = document.getElementById('bookForm');
const responseBox = document.getElementById('response');
const bookList = document.getElementById('bookList');
const viewBooksBtn = document.getElementById('viewBooksBtn');

const GRAPHQL_ENDPOINT = 'https://vtmjaouvabfkxzuljnsx.supabase.co/graphql/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0bWphb3V2YWJma3h6dWxqbnN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNDgwNjQsImV4cCI6MjA2NzYyNDA2NH0.KhAyEvaJeA1dtbN28Z9nxwKbyQ5-_5y4TiU93usRdts';

// 📚 Load and display books
async function loadBooks() {
  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY
      },
      body: JSON.stringify({
        query: `
          {
            booksCollection {
              edges {
                node {
                  title
                  author {
                    names
                  }
                }
              }
            }
          }
        `
      })
    });

    const data = await res.json();
    const books = data.data?.booksCollection?.edges || [];

    bookList.innerHTML = '';

    books.forEach(({ node }) => {
      const item = document.createElement('li');
      item.textContent = `"${node.title}" by ${node.author?.names || 'Unknown Author'}`;
      bookList.appendChild(item);
    });

  } catch (err) {
    responseBox.textContent = `❌ Failed to load books: ${err.message}`;
  }
}

// 📖 Handle "View Stored Books" button click
viewBooksBtn.addEventListener('click', loadBooks);

// ✏️ Handle form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const authorName = document.getElementById('authorName').value.trim();
  const bookTitle = document.getElementById('bookTitle').value.trim();

  try {
    // 🔍 Check if author exists
    const checkAuthorRes = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY
      },
      body: JSON.stringify({
        query: `
          query {
            authorsCollection(filter: { names: { eq: "${authorName}" } }) {
              edges {
                node {
                  id
                }
              }
            }
          }
        `
      })
    });

    const checkAuthorData = await checkAuthorRes.json();
    let authorId;
    const existingAuthor = checkAuthorData.data?.authorsCollection?.edges?.[0];

    if (existingAuthor) {
      authorId = existingAuthor.node.id;
    } else {
      const insertAuthorRes = await fetch(GRAPHQL_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY
        },
        body: JSON.stringify({
          query: `
            mutation {
              insertIntoauthorsCollection(objects: { names: "${authorName}" }) {
                records {
                  id
                }
              }
            }
          `
        })
      });

      const authorData = await insertAuthorRes.json();
      if (authorData.errors) {
        responseBox.textContent = `GraphQL Error: ${authorData.errors[0].message}`;
        return;
      }

      authorId = authorData.data?.insertIntoauthorsCollection?.records?.[0]?.id;
      if (!authorId) {
        responseBox.textContent = "Could not retrieve author ID.";
        return;
      }
    }

    // 📘 Insert book
    const insertBookRes = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_KEY
      },
      body: JSON.stringify({
        query: `
          mutation {
            insertIntobooksCollection(objects: {
              title: "${bookTitle}",
              author_id: ${authorId}
            }) {
              records {
                book_id
                title
              }
            }
          }
        `
      })
    });

    const bookData = await insertBookRes.json();
    if (bookData.errors) {
      responseBox.textContent = `GraphQL Error: ${bookData.errors[0].message}`;
      return;
    }

    responseBox.textContent = `✅ Book "${bookTitle}" by "${authorName}" added successfully!`;
    form.reset();
    loadBooks(); // 🔄 Refresh list after adding
  } catch (err) {
    responseBox.textContent = `❌ Error: ${err.message}`;
  }
});
