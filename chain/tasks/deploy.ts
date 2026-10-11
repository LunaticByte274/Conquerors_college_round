
import { task, types } from "hardhat/config";

task("deploy", "Deploy the Incognito reporting contract")
    .addOptionalParam(
        "semaphore",
        "Semaphore contract address",
        undefined,
        types.string
    )
    .addOptionalParam("logs", "Print the logs", true, types.boolean)
    .setAction(async ({ logs, semaphore: semaphoreAddress }, { ethers, run }) => {
        if (!semaphoreAddress) {
            const { semaphore } = await run("deploy:semaphore", { logs });
            semaphoreAddress = await semaphore.getAddress();
        }

        const IncognitoFactory = await ethers.getContractFactory("Incognito");
        const incognito = await IncognitoFactory.deploy(semaphoreAddress);

        await incognito.waitForDeployment();

        if (logs) {
            console.info(
                `Incognito contract deployed to: ${await incognito.getAddress()}`
            );
        }

        return incognito;
    });
