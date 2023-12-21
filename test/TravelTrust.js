const { expect } = require("chai");

describe("TravelTrust Contract", function () {
  let TravelTrust;
  let travelTrust;
  let owner;
  let buyer;

  beforeEach(async function () {
    // Get the ContractFactory and Signers here.
    TravelTrust = await ethers.getContractFactory("TravelTrust");
    [owner, buyer] = await ethers.getSigners();

    // Deploy a new TravelTrust contract for each test
    travelTrust = await TravelTrust.deploy();
    await travelTrust.deployed();
  });

  describe("Deployment", function () {
    it("Should track the number of offers", async function () {
      expect(await travelTrust.nextOfferId()).to.equal(0);
    });
  });

  describe("createOffer", function () {
    it("Should create an offer and emit an event", async function () {
      await expect(
        travelTrust.createOffer(
          "Test Description",
          ethers.utils.parseEther("1")
        )
      )
        .to.emit(travelTrust, "OfferCreated")
        .withArgs(
          0,
          owner.address,
          "Test Description",
          ethers.utils.parseEther("1")
        );

      const offer = await travelTrust.getOffer(0);
      expect(offer[1]).to.equal("Test Description"); // Access by index
      expect(offer[2]).to.equal(ethers.utils.parseEther("1"));
      expect(offer[3]).to.equal(true);
    });
  });

  describe("buyOffer", function () {
    it("Should allow a user to buy an offer", async function () {
      const offerPrice = ethers.utils.parseEther("1");
      await travelTrust.createOffer("Test Description", offerPrice);

      await expect(
        travelTrust.connect(buyer).buyOffer(0, { value: offerPrice })
      )
        .to.emit(travelTrust, "OfferSold")
        .withArgs(0, buyer.address, "Test Description", offerPrice);

      const offer = await travelTrust.getOffer(0);
      expect(offer[3]).to.equal(false); // Access by index
    });
  });
});
