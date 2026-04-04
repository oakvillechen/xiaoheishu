import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { users, posts } from './schema';

const client = createClient({
  url: 'file:local.db', // Use local for seeding 50 posts
});

const db = drizzle(client, { schema });

const cities = ['Toronto', 'Vancouver', 'Montreal', 'Oakville', 'Ottawa', 'Calgary', 'Burnaby', 'Markham'];
const categories = ['Life', 'Job', 'Study', 'Immigration', 'Food', 'RealEstate'];
const tags = ['#加拿大生活', '#多伦多求职', '#温哥华美食', '#移民政策', '#加拿大留学', '#省提名', '#理财分享', '#周末去哪儿'];

const mockUsers = [
  { id: 'user_1', displayName: 'MapleLeaf_Anna', email: 'anna@example.com', photoURL: 'https://i.pravatar.cc/150?u=anna' },
  { id: 'user_2', displayName: 'Toronto_Jay', email: 'jay@example.com', photoURL: 'https://i.pravatar.cc/150?u=jay' },
  { id: 'user_3', displayName: 'VanCity_Girl', email: 'van@example.com', photoURL: 'https://i.pravatar.cc/150?u=van' },
  { id: 'user_4', displayName: 'Oakville_Living', email: 'oak@example.com', photoURL: 'https://i.pravatar.cc/150?u=oak' },
];

const postIdeas = [
  { title: "多伦多大厂内推，码农必看！", category: "Job", tags: "#多伦多求职,#IT内推", link: "https://www.google.com" },
  { title: "温哥华超火的Brunch，排队2小时也值得", category: "Food", tags: "#温哥华美食,#Brunch", link: "https://www.google.com" },
  { title: "2024年EE邀请分数预测，新政解读", category: "Immigration", tags: "#移民政策,#EE", link: "https://www.google.com" },
  { title: "Oakville 绝美湖边步道，周末遛娃胜地", category: "Life", tags: "#Oakville,#周末去哪儿", link: "https://www.google.com" },
  { title: "加拿大留学生退税攻略，手把手教你", category: "Study", tags: "#留学生退税,#理财", link: "https://www.google.com" },
  { title: "如何选择多伦多的公寓？中介不告诉你的秘密", category: "RealEstate", tags: "#多伦多租房,#买房建议", link: "https://www.google.com" },
  { title: "大瀑布附近的秘境酒庄，人少景美", category: "Life", tags: "#大瀑布,#酒庄", link: "https://www.google.com" },
  { title: "滑铁卢大学CS面经分享", category: "Study", tags: "#滑铁卢大学,#面试经验", link: "https://www.google.com" },
  { title: "蒙特利尔老城一日游：法式风情在北美", category: "Life", tags: "#蒙特利尔,#旅游攻略", link: "https://www.google.com" },
  { title: "卡尔加里搬砖日记：雪地里的希望", category: "Job", tags: "#卡尔加里,#生活感悟", link: "https://www.google.com" },
];

async function seed() {
  console.log('Seed started...');
  
  // Clear existing
  await db.delete(posts);
  await db.delete(users);

  // Insert mock users
  await db.insert(users).values(mockUsers);

  const postsToInsert = [];
  for (let i = 0; i < 50; i++) {
    const idea = postIdeas[i % postIdeas.length];
    const user = mockUsers[i % mockUsers.length];
    const city = cities[Math.floor(Math.random() * cities.length)];
    
    postsToInsert.push({
      title: `${idea.title} - [${i + 1}]`,
      content: `这是关于${city}的一篇分享帖。内容非常精彩，欢迎大家转发原贴查看详情。关于加拿大的${idea.category}信息，一站式获取！`,
      link: idea.link,
      previewImage: `https://picsum.photos/seed/${i + 50}/600/800`,
      userId: user.id,
      city: city,
      category: idea.category,
      tags: idea.tags,
    });
  }

  await db.insert(posts).values(postsToInsert);
  console.log('Seed finished with 50 posts.');
}

seed().catch(err => console.error(err));
