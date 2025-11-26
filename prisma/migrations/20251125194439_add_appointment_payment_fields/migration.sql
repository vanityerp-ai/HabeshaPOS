-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "discountAmount" DECIMAL(65,30),
ADD COLUMN     "discountPercentage" DECIMAL(65,30),
ADD COLUMN     "finalAmount" DECIMAL(65,30),
ADD COLUMN     "originalAmount" DECIMAL(65,30),
ADD COLUMN     "paymentDate" TIMESTAMP(3),
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "paymentStatus" TEXT,
ADD COLUMN     "transactionRecorded" BOOLEAN DEFAULT false;
