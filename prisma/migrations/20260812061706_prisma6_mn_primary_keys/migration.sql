-- AlterTable
ALTER TABLE "_PostPages" ADD CONSTRAINT "_PostPages_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_PostPages_AB_unique";
