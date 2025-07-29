const form = document.getElementById('bookForm');
const responseBox = document.getElementById('response');
const bookList = document.getElementById('bookList');
const viewBooksBtn = document.getElementById('viewBooksBtn');

const GRAPHQL_ENDPOINT = 'https://vtmjaouvabfkxzuljnsx.supabase.co/graphql/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0bWphb3V2YWJma3h6dWxqbnN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwNDgwNjQsImV4cCI6MjA2NzYyNDA2NH0.KhAyEvaJeA1dtbN28Z9nxwKbyQ5-_5y4TiU93usRdts';

// Load and display books
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
                  file_url
                  authors {
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

    bookList.innerHTML = `
  <table border="1" cellpadding="8" cellspacing="0">
    <thead>
      <tr>
        <th>Title</th>
        <th>Author</th>
        <th>Download</th>
      </tr>
    </thead>
    <tbody>
      ${books.map(({ node }) => {
        const author = node.authors?.names || 'Unknown Author';
        const fileLink = node.file_url
          ? `<a href="${node.file_url}" target="_blank"> Download</a>`
          : 'No file';
        return `
          <tr>
            <td>${node.title}</td>
            <td>${author}</td>
            <td>${fileLink}</td>
          </tr>
        `;
      }).join('')}
    </tbody>
  </table>
`;



  } catch (err) {
    responseBox.textContent = `Failed to load books: ${err.message}`;
  }
}

// Handle "View Stored Books" button click
viewBooksBtn.addEventListener('click', loadBooks);

// Handle form submission
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const authorName = document.getElementById('authorName').value.trim();
  const bookTitle = document.getElementById('bookTitle').value.trim();
  const fileInput = document.getElementById('bookFile');
  const file = fileInput.files[0];

  if (!file) {
    responseBox.textContent = "❌ Please select a file to upload.";
    return;
  }

  const filePath = `${Date.now()}_${file.name}`;
  const fileUrl = `https://vtmjaouvabfkxzuljnsx.supabase.co/storage/v1/object/public/books-files/${filePath}`;

  try {
    // Upload file to Supabase Storage (public bucket)
    const uploadRes = await fetch(`https://vtmjaouvabfkxzuljnsx.supabase.co/storage/v1/object/books-files/${filePath}`, {
  method: 'POST',
  headers: {
    'Content-Type': file.type,
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`
  },
  body: file
});


    if (!uploadRes.ok) {
      const errorText = await uploadRes.text();
      responseBox.textContent = `❌ Failed to upload file: ${uploadRes.status} ${uploadRes.statusText} - ${errorText}`;
      return;
    }

    // Check if author exists
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

    // Insert book with file URL
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
              author_id: ${authorId},
              file_url: "${fileUrl}"
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

    responseBox.textContent = `✅ Book "${bookTitle}" by "${authorName}" uploaded successfully!`;
    form.reset();
    loadBooks();
  } catch (err) {
    responseBox.textContent = `❌ Error: ${err.message}`;
  }
});
