from crewai import Agent, Crew, Task
from logging_config import get_logger
from tools import GetSwapQuoteTool, GetPoolAddressTool, CalculateMinOutputTool, MinswapSwapTool

class ResearchCrew:
    def __init__(self, verbose=True, logger=None):
        self.verbose = verbose
        self.logger = logger or get_logger(__name__)
        self.crew = self.create_crew()
        self.logger.info("ResearchCrew initialized")

    def create_crew(self):
        self.logger.info("Creating research crew with agents")
        
        researcher = Agent(
            role='Research Analyst',
            goal='Find and analyze key information',
            backstory='Expert at extracting information',
            verbose=self.verbose
        )

        writer = Agent(
            role='Content Summarizer',
            goal='Create clear summaries from research',
            backstory='Skilled at transforming complex information',
            verbose=self.verbose
        )

        converter = Agent(
            role='Token Converter',
            goal='Generate the transaction for swapping tokens on the Cardano chain using a specific DEX. Identify the Base token, target token and amounts from the text input',
            backstory='Expert in Cardano blockchain transactions, DEX integrations, and swap operations',
            verbose=self.verbose,
            tools=[ MinswapSwapTool()]
        )

        self.logger.info("Created research, writer, and converter agents")

        crew = Crew(
            agents=[
                # researcher, writer,
                converter],
            tasks=[
                # Task(
                #     description='Research: {text}',
                #     expected_output='Detailed research findings about the topic',
                #     agent=researcher
                # ),
                # Task(
                #     description='Write summary',
                #     expected_output='Clear and concise summary of the research findings',
                #     agent=writer
                # ),
                Task(
                    description='Convert the tokens using DEX on Cardano. Here\'s the input: {text}',
                    expected_output='The unsigned transaction details (e.g., CBOR hex, inputs, outputs, fees) that the user can sign and submit to execute the swap. Assume the user has the necessary wallet setup.',
                    agent=converter
                )
            ]
        )
        self.logger.info("Crew setup completed")
        return crew