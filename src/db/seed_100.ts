import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { users, posts, comments } from './schema';
import 'dotenv/config';

const client = createClient({
  url: process.env.DATABASE_URL!,
  authToken: process.env.DATABASE_AUTH_TOKEN!,
});

const db = drizzle(client, { schema });

const cities = ['Toronto', 'Vancouver', 'Montreal', 'Oakville', 'Ottawa', 'Calgary', 'Edmonton', 'Victoria', 'Richmond', 'Markham'];
const categories = ['Life', 'Job', 'Study', 'Immigration', 'Food', 'RealEstate', 'Finance'];

const mockUsers = [
  { id: 'user_1', displayName: 'Maple_Anna', email: 'anna@example.com', photoURL: 'https://i.pravatar.cc/150?u=anna' },
  { id: 'user_2', displayName: 'GTA_Jay', email: 'jay@example.com', photoURL: 'https://i.pravatar.cc/150?u=jay' },
  { id: 'user_3', displayName: 'VanCity_Girl', email: 'van@example.com', photoURL: 'https://i.pravatar.cc/150?u=van' },
  { id: 'user_4', displayName: 'Oakville_Dad', email: 'oak@example.com', photoURL: 'https://i.pravatar.cc/150?u=oak' },
  { id: 'user_5', displayName: 'Study_Canada', email: 'study@example.com', photoURL: 'https://i.pravatar.cc/150?u=study' },
];

const topics = [
  { 
    title: "多伦多 IT 求职全攻略：从简历到面试", 
    category: "Job",
    content: "在多伦多找 IT 工作，简历的格式至关重要。首先，必须符合北美的简洁风格。内容方面，重点突出你的项目经验和技术栈。面试环节通常分为：1. HR 电话面试（行为面试）；2. 技术初面（算法/基础）；3. 最终面（架构/团队适配）。在多伦多，Networking 非常重要，LinkedIn 上的内推往往比海投更有效。此外，很多大厂如 Amazon, Google 在多伦多都有办公室，建议关注他们的 Career Page。薪资方面，Senior 级别通常在 140k-180k CAD 左右。希望大家都能拿到心仪的 Offer！"
  },
  {
    title: "温哥华留学生活费真实测评：一个月到底花多少？",
    category: "Study",
    content: "很多小伙伴问我温哥华的生活费。作为在这里呆了3年的老学姐，我来给大家算一笔账。房租：现在温哥华租房真心贵，两室一厅的一个房间大概就要 $1200-$1600。饮食：如果天天外食，一顿饭加小费 $25 起，自己做饭大概一个月 $500 左右。交通：Compass Card 一个月大概 $100-$180（看区域）。保险：UBC/SFU 都有学生保险。总的来说，一个留学生在温哥华生活，每个月至少准备 $2500-$3000。建议大家尽早找兼职，减轻负担！"
  },
  {
    title: "奥克维尔 (Oakville) 高端社区深度测评：环境与学区",
    category: "RealEstate",
    content: "Oakville 被誉为大多伦多地区的“花园城市”。这里的环境非常优美，尤其是湖边步道（Lakeshore）。学区方面，Iroquois Ridge 和 Oakville Trafalgar 都是全省名列前茅的中学。这里的社区治安极好，非常适合有小孩的家庭。房价方面，虽然比多伦多市区稍便宜，但独栋豪宅的价格依然稳健在 $2M 以上。生活配套齐全，上车建议关注 North Oakville 的新房。这里华人群体正在逐渐扩大，配套的补习班和超市也越来越多。"
  },
  {
    title: "2024年加拿大省提名 (PNP) 详细步骤拆解",
    category: "Immigration",
    content: "PNP 是目前移民加拿大的热门途径。首先，你需要确定你想去哪个省（如 ON, BC, AB）。每个省都有不同的 Stream（硕士、雇主担保、技术移民）。步骤如下：1. 符合省提名要求并入池；2. 获得全省邀请（ITA）；3. 提交全套资料给省政府审核；4. 获得提名信；5. 向联邦提交永居申请（PR）。提名信可以为你的 EE 分数增加 600 分，基本保证获邀。建议大家多关注各省的实时邀请分数，机会总是留给有准备的人！"
  },
  {
    title: "多伦多必去的10个宝藏湖边：不仅仅是湖滨中心",
    category: "Life",
    content: "除了 Waterfront，多伦多还有很多绝美的湖边。1. Toronto Island（必去，看天际线）；2. Woodbine Beach（沙滩排球神地）；3. Bluffers Park（大峡谷即视感）；4. Humber Bay Shores（看夕阳首选）；5. Cherry Beach（适合野餐）。每个地方都有其独特的魅力，非常适合周末放松。建议大家自驾前往，记得提前查看停车信息。多伦多的夏天非常短暂，一定要抓紧时间亲近大自然！"
  }
];

// Content Generator for 100 unique long posts
async function seedDetailed() {
  console.log('Detailed Seed Started (100 Posts)...');
  
  // Clean up
  await db.delete(comments);
  await db.delete(posts);
  await db.delete(users);

  // Insert Users
  await db.insert(users).values(mockUsers);

  const postsToInsert = [];
  for (let i = 0; i < 100; i++) {
    const topic = topics[i % topics.length];
    const user = mockUsers[Math.floor(Math.random() * mockUsers.length)];
    const city = cities[Math.floor(Math.random() * cities.length)];
    
    // Generate long content (simulating ~1500-2000 chars)
    let longContent = `${topic.content}\n\n`;
    longContent += "以下是更多详细补充内容：\n";
    longContent += "1. 这里的细节非常值得关注，许多人在这里遇到了挑战。\n";
    longContent += "2. 根据最新的政策变动，这一块的逻辑已经发生了一些变化，你需要特别注意时间节点。\n";
    longContent += "3. 建议在行动之前，先咨询专业的顾问或已经在当地生活的人士。\n";
    longContent += "4. 相关的成本预算一定要留出 20% 的冗余，因为加拿大的各种隐形开销不少。\n";
    longContent += "5. 关于后续的持续更新，我会在小黑书上继续分享相关的心得，欢迎大家关注我并留言交流。\n\n";
    longContent += "最后，祝愿在加拿大小伙伴们都能生活愉快，事业有成！加油！";

    postsToInsert.push({
      title: `${topic.title} - [深度解析系列 ${i + 1}]`,
      content: longContent,
      link: "https://www.google.com/search?q=canada+living",
      previewImage: `https://picsum.photos/seed/${i + 200}/800/1000`,
      userId: user.id,
      city: city,
      category: topic.category,
      tags: `${topic.category},#加拿大生活,#${city}`,
    });
  }

  await db.insert(posts).values(postsToInsert);
  console.log('Successfully injected 100 deep-content posts.');
}

seedDetailed().catch(err => console.error(err));
