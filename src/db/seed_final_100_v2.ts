import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';
import { users, posts, comments } from './schema';
import 'dotenv/config';
import path from 'path';
import { config } from 'dotenv';

const envConfig = config({ path: path.join(process.cwd(), '.env') }).parsed;
const url = envConfig?.DATABASE_URL || process.env.DATABASE_URL!;
const authToken = envConfig?.DATABASE_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN!;

const client = createClient({ url, authToken });
const db = drizzle(client, { schema });

const mockUsers = [
  { id: 'user_1', displayName: '蒙城老王', email: 'wang@montreal.com', photoURL: 'https://i.pravatar.cc/150?u=mtl' },
  { id: 'user_2', displayName: '卡城乐活', email: 'lehuo@calgary.com', photoURL: 'https://i.pravatar.cc/150?u=yyc' },
  { id: 'user_3', displayName: '渥太华观察员', email: 'ottawa@ottawa.com', photoURL: 'https://i.pravatar.cc/150?u=yow' },
  { id: 'user_4', displayName: '海洋省向导', email: 'guide@maritimes.com', photoURL: 'https://i.pravatar.cc/150?u=hfx' },
  { id: 'user_5', displayName: '海洋省指南', email: 'guide@maritimes.com', photoURL: 'https://i.pravatar.cc/150?u=halifax' },
];

const allFinalPosts: any[] = [];

// Content Engine for Personas
const getPersonaContent = (cat: string, city: string, title: string, seed: number) => {
  if (cat === 'Life') {
    return `在${city}生活了快三年了，今天关于“${title}”这件事，我真的有很多话想说。\n\n刚落地${city}的时候，最直观的感受就是那种扑面而来的生活感。记得在${city}的某个午后，我走在当地老区的街道上，看着路边那些各具特色的外墙和偶尔走过的邻居，那种“这就是我的新家”的踏实感油然而升。\n\n生活在${city}，最难忘的还是它的季节更迭。这里的冬天虽然漫长，但也有一种属于它的宁静。而在春夏之际，每一个社区中心都会变得异常热闹。我渐渐发现，在${city}定居并不是一种漂泊，而是一次重新审视生活的契机。在这里，我学会了在周末放下工作，去附近的公园坐一下午，或者在清晨的咖啡馆里发呆。如果你问我移民最大的收获是什么，我觉得不是一张枫叶卡，而是学会了如何在这份平凡中找到属于自己的节奏。对于每一个向往这片土地的华人来说，${city}既是一个挑战，更是一个拥抱。`;
  }
  
  if (cat === 'Immigration' || cat === 'Study') {
    return `针对“${title}”这一关键话题，本文将基于 2026 年最新的 IRCC 政策和${city}当地的省提名（PNP）数据进行深度解析。\n\n首先，对于申请人来说，目前的评估标准（CRS/CLB）已经显著提高了语言权重的比分。在${city}所在的省份，其省提名项目（如 AAIP 或 MPNP）对于本地工作经验的加分政策也在发生微妙变化。根据最新的库内抽签数据，特定领域的专业背景（如 STEM、医疗或法语能力）在 2026 年的中签概率比以往任何时候都要高。建议申请人尽早建立 CRS 档案，并密切关注该省劳动力市场的紧缺职业清单。\n\n对于留学生而言，${city}当地的大学排名（如蒙大、阿大、或达大）在学术界和求职市场有着不同的定位。我们分析了过去五年的毕业生就业数据，发现 CO-OP 实习经验是成功转为 PR 的核心跳板。总体来看，“${title}”不仅是一个行政过程，更是一次综合背景的长期博弈。建议咨询专业的法律机构进行个案评估。`;
  }
  
  if (cat === 'Food' || cat === 'RealEstate' || cat === 'Finance') {
    return `关于“${title}”的实地测评报告如下：\n\n【测评对象】：${city}当地特色及相关配套\n【综合评分】：★★★★☆ (4.5/5)\n\n【优点详解】：\n1. 性价比：比起大多伦多区域，${city}在同等消费水平下的获得感更高。特别是这里的餐饮文化和房产配置，极具本地特色。\n2. 口味/配套：经实测，这里的服务不仅保留了传统风味，更在细节上展现了极高的专业度。以房产为例，该区域的基建水平和社区中心（Community Center）的密集度在全加名列前茅。\n\n【建议避坑】：\n1. 虽然整体表现出色，但在部分高峰期（如滑雪季或龙虾季），人流会异常密集，建议提前一个月预定。\n2. 部分老店（或老区房产）可能存在设施陈旧的问题，购买或去探店前务必查看最新的评价指标。总的来说，“${title}”是我们在${city}探访中非常惊喜的一站。`;
  }
  
  if (cat === 'Job') {
    return `作为在${city}职场“摸爬滚打”了多年的老伙计，今天我必须得来吐槽（评价）一下“${title}”这件事。\n\n在${city}的职场，那种所谓的“北美慢节奏”在某些行业其实就是传说。特别是有些大厂，管理文化极其注重各种形式的汇报（Process），有时候推进一个项目需要跨过十个部门。这里的管理层观点往往非常保守，如果你是刚从国内互联网大厂出来的“卷王”，你可能会感到一种前所未有的内耗感。而且，关于薪资水平，这里的透明度其实并不高。很多人吐槽说这里的税后果实并没有看起来那么丰硕，而且在涨薪和晋升通道上，存在着一种隐形的“天花板”。\n\n然而，硬币的另一面是，${city}的职场确实更注重 Work-life balance 的形式。只要你心态放平，这里确实是享受家庭生活的天堂。但如果你追求的是那种极致的职业爆发力，那我们在${city}的职场评价体系里，真的要打一个不小的问号。这，就是真实的、充满吐槽点但也充满安逸感的${city}职场现状。`;
  }

  return `这是关于${title}的深度分析报告。内容涵盖了${city}生活的各个层面，从职场到生活，从教育到移民。`;
};

// Titles Generation for 100 Posts
const cities = [
  { name: 'Toronto', slug: 'yyz', user: 'user_4', count: 9 },
  { name: 'Vancouver', slug: 'yvr', user: 'user_3', count: 9 },
  { name: 'Montreal', slug: 'mtl', user: 'user_1', count: 9 },
  { name: 'Calgary', slug: 'yyc', user: 'user_2', count: 9 },
  { name: 'Ottawa', slug: 'yow', user: 'user_3', count: 9 },
  { name: 'Edmonton', slug: 'yeg', user: 'user_1', count: 9 },
  { name: 'Mississauga', slug: 'sauga', user: 'user_4', count: 9 },
  { name: 'Winnipeg', slug: 'ywg', user: 'user_2', count: 9 },
  { name: 'Halifax', slug: 'yhz', user: 'user_5', count: 9 },
  { name: 'PEI', slug: 'pei', user: 'user_1', count: 9 },
  { name: 'Oakville', slug: 'oak', user: 'user_2', count: 10 }
];

const categories = ['Life', 'Job', 'Immigration', 'Study', 'Food', 'RealEstate', 'Finance'];

async function seedFinalV2() {
  console.log('--- PURGING TABLES ---');
  await db.delete(comments);
  await db.delete(posts);
  await db.delete(users);
  await db.insert(users).values(mockUsers);
  console.log('--- TABLES PURGED AND USERS LOADED ---');

  let globalId = 0;
  for (const city of cities) {
    for (let j = 0; j < city.count; j++) {
      globalId++;
      const cat = categories[globalId % categories.length];
      const title = `[${city.name}精选] ${city.name}的真实生活与${cat}挑战 #${globalId}`;
      const content = getPersonaContent(cat, city.name, title, globalId);
      
      // Map to local generated images
      const imgPath = `/images/posts/${city.name.toLowerCase()}.png`;

      allFinalPosts.push({
        title,
        content,
        city: city.name,
        category: cat,
        userId: city.user,
        previewImage: imgPath,
        link: 'https://www.canada.ca',
        tags: `#${city.name},#${cat},#深度干货`
      });
    }
  }

  console.log(`Inserting ${allFinalPosts.length} posts...`);
  
  // Chunked insert
  for (let i = 0; i < allFinalPosts.length; i += 25) {
    const chunk = allFinalPosts.slice(i, i + 25);
    await db.insert(posts).values(chunk);
  }

  console.log('--- SEEDING V4 COMPLETE (100 PERSONA-DRIVEN POSTS) ---');
}

seedFinalV2().catch(err => console.error(err));
