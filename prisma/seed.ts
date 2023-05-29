import { PrismaClient } from '@prisma/client';
import userData from './data.json' assert { type: 'json' };

const db = new PrismaClient();

async function main() {
    console.log(`Start seeding ...`);

    for (const p of userData) {
        const user = await db.user.create({
            data: {
                username: p.username,
                email: p.email,
                role: p.role,
            },
        });
        console.log(`Created user with id: ${user.id}`);
    }
    console.log(`Seeding finished.`);
}

main()
    .then(async () => {
        await db.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await db.$disconnect();
        process.exit(1);
    });
