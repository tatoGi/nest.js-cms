export * from './create-page-aggregate.dto';
export * from './update-page-aggregate.dto';
export * from './page-aggregate-response.dto';
export * from './page-query.dto';
export * from './page-list-item.dto';
export * from './pagination.dto';

// ## 🎨 **Example Requests**

// ### **Create Page**
// ```typescript
// POST /api/admin/pages
// {
//   "template": "standard",
//   "sortOrder": 0,
//   "published": true,
//   "showInMenu": true,
//   "isHome": false,
//   "translations": [
//     {
//       "languageId": 1,
//       "title": "About Us",
//       "slug": "about-us",
//       "subtitle": "Learn more about our company",
//       "excerpt": "We are a leading provider...",
//       "blocks": [
//         {
//           "type": "hero-banner",
//           "data": {
//             "title": "Welcome",
//             "backgroundImage": "/images/hero.jpg"
//           },
//           "sortOrder": 0
//         },
//         {
//           "type": "rich-text",
//           "data": {
//             "content": "<p>Our story began...</p>"
//           },
//           "sortOrder": 1
//         }
//       ]
//     },
//     {
//       "languageId": 2,
//       "title": "О нас",
//       "slug": "o-nas",
//       "subtitle": "Узнайте больше о нашей компании",
//       "blocks": [...]
//     }
//   ]
// }
// ```

// ### **Get Page by Slug (Public)**
// ```bash
// GET /api/pages/slug/about-us?languageId=1
// ```

// **Response:**
// ```json
// {
//   "id": 1,
//   "template": "standard",
//   "sortOrder": 0,
//   "published": true,
//   "showInMenu": true,
//   "isHome": false,
//   "translations": [
//     {
//       "languageId": 1,
//       "title": "About Us",
//       "slug": "about-us",
//       "subtitle": "Learn more about our company",
//       "excerpt": "We are a leading provider...",
//       "content": null,
//       "metaTitle": "About Us | Company",
//       "metaDescription": "Learn about our company...",
//       "publishedAt": "2024-01-01T00:00:00.000Z",
//       "blocks": [
//         {
//           "type": "hero-banner",
//           "data": { "title": "Welcome" },
//           "sortOrder": 0
//         }
//       ]
//     }
//   ],
//   "createdAt": "2024-01-01T00:00:00.000Z",
//   "updatedAt": "2024-01-01T00:00:00.000Z"
// }
