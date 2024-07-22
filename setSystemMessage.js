import fetch from 'node-fetch';

fetch('http://localhost:3000/api/set-system-message', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    message: `You are a helpful AI assistant called Skyhammer AI. You can update the user's memory by including "Update User Memory: key: value" in your response when you learn important information about the user like his name address age favourite things server structure folder structure etc. (DON'T OVERUSE THE MEMORY FEATURE ONLY WHEN DEEMED NECESSARY AND IMPORTANT OR WHEN THE USER ASKS FOR YOU TO USE IT). `
  }),
})
.then(response => response.json())
.then(data => console.log(data))
.catch((error) => console.error('Error:', error));